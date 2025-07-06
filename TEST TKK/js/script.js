// --- Global State ---
        let generatedImagesData = [];
        let selectedForEnhancement = null;
        
        // --- DOM Element Selection ---
        const generateBtn = document.getElementById('generate-btn');
        const enhanceBtn = document.getElementById('enhance-btn');
        const ideaBtn = document.getElementById('idea-btn');
        const copyBtn = document.getElementById('copy-btn');
        const pasteBtn = document.getElementById('paste-btn');
        const clearBtn = document.getElementById('clear-btn');
        const allActionButtons = [generateBtn, enhanceBtn, ideaBtn, copyBtn, pasteBtn, clearBtn];
        const promptInput = document.getElementById('prompt-input');
        const loadingIndicator = document.getElementById('loading-indicator');
        const loadingText = document.getElementById('loading-text');
        const imageGrid = document.getElementById('image-grid');
        const historyContainer = document.getElementById('history-container');
        const historyPlaceholder = document.getElementById('history-placeholder');
        
        // Info Modal
        const infoModal = document.getElementById('info-modal');
        const infoModalTitle = document.getElementById('info-modal-title');
        const infoModalMessage = document.getElementById('info-modal-message');
        
        // Preview Modal
        const previewModal = document.getElementById('preview-modal');
        const previewImage = document.getElementById('preview-image');
        const previewPrompt = document.getElementById('preview-prompt');
        const closePreviewBtn = document.getElementById('close-preview-btn');
        const reusePromptBtn = document.getElementById('reuse-prompt-btn');

        // Donation Modal
        const donationBtn = document.getElementById('donation-btn');
        const donationModal = document.getElementById('donation-modal');
        const closeDonationBtn = document.getElementById('close-donation-btn');
        const sendDonationBtn = document.getElementById('send-donation-btn');

        // Options
        const modelSelect = document.getElementById('model-select');
        const artStyleSelect = document.getElementById('art-style-select');
        const styleSelect = document.getElementById('style-select');
        const sizeSelect = document.getElementById('size-select');
        const batchSelect = document.getElementById('batch-select');

        // Theme Toggle
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        const themeText = document.getElementById('theme-text');

        // --- Initial Setup ---
        function resetGridToPlaceholder() {
            imageGrid.className = 'w-full h-full flex items-center justify-center';
            imageGrid.innerHTML = `
                <div class="text-center text-gray-500">
                    <i class="ph-fill ph-image-square text-6xl"></i>
                    <p class="mt-4 font-medium">Gambar Anda akan muncul di sini</p>
                </div>
            `;
        }
        resetGridToPlaceholder();

        // --- UI Control Functions ---
        const toggleButtons = (disabled) => [generateBtn, enhanceBtn, ideaBtn].forEach(btn => btn.disabled = disabled);
        const showInfoModal = (title, message) => {
            infoModalTitle.textContent = title;
            infoModalMessage.textContent = message;
            infoModal.classList.remove('hidden');
        };
        const closeInfoModal = () => infoModal.classList.add('hidden');

        // --- Preview Modal Functions ---
        function showPreviewModal(imageUrl, promptText) {
            previewImage.src = imageUrl;
            
            if (promptText.length > 150) {
                previewPrompt.textContent = promptText.substring(0, 150) + '...';
            } else {
                previewPrompt.textContent = promptText;
            }
            
            reusePromptBtn.onclick = () => {
                promptInput.value = promptText;
                closePreviewModal();
                promptInput.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            previewModal.classList.remove('hidden');
        }
        function closePreviewModal() {
            previewModal.classList.add('hidden');
        }
        closePreviewBtn.addEventListener('click', closePreviewModal);
        previewModal.addEventListener('click', (e) => {
            if (e.target.id === 'preview-modal') {
                closePreviewModal();
            }
        });

        // --- Donation Modal Functions ---
        function openDonationModal() {
            donationModal.classList.remove('hidden');
        }
        function closeDonationModal() {
            donationModal.classList.add('hidden');
        }
        donationBtn.addEventListener('click', openDonationModal);
        closeDonationBtn.addEventListener('click', closeDonationModal);
        sendDonationBtn.addEventListener('click', () => {
            showInfoModal('Segera Hadir', 'Fitur pembayaran donasi akan segera diimplementasikan. Terima kasih atas niat baik Anda!');
        });


        // --- Download Function ---
        async function downloadImage(imageUrl, prompt) {
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    throw new Error('Gagal mengambil data gambar dari server.');
                }
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                const safePrompt = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                link.download = `tkk-imagen-${safePrompt || 'image'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);

            } catch (error) {
                console.error("Download error:", error);
                showInfoModal("Gagal Mengunduh", "Tidak dapat mengunduh gambar secara otomatis. Silakan coba klik kanan pada gambar dan pilih 'Simpan Gambar Sebagai...'.");
            }
        }

        // --- Persistent History with IP Lock (24h) ---
        // Helper: Get IP address (simple, via external service)
        async function getUserIP() {
            try {
            const res = await fetch('https://api.ipify.org?format=json');
            if (!res.ok) throw new Error('Failed to get IP');
            const data = await res.json();
            return data.ip;
            } catch (e) {
            // Fallback: use a random string (not ideal, but prevents breakage)
            return 'unknown-ip-' + (localStorage.getItem('tkk-fallback-id') || (() => {
                const id = Math.random().toString(36).slice(2);
                localStorage.setItem('tkk-fallback-id', id);
                return id;
            })());
            }
        }

        // Save/load history to localStorage with IP and timestamp
        async function saveHistoryToStorage() {
            const ip = await getUserIP();
            const now = Date.now();
            const historyData = Array.from(historyContainer.querySelectorAll('img')).map(img => ({
            url: img.src,
            prompt: img.getAttribute('data-prompt') || '',
            ts: now
            }));
            localStorage.setItem('tkk-history', JSON.stringify({
            ip,
            ts: now,
            items: historyData
            }));
        }

        async function loadHistoryFromStorage() {
            const data = localStorage.getItem('tkk-history');
            if (!data) return;
            let parsed;
            try {
            parsed = JSON.parse(data);
            } catch {
            return;
            }
            const ip = await getUserIP();
            // Only load if IP matches and within 24h
            if (parsed.ip !== ip) return;
            if (Date.now() - parsed.ts > 24 * 60 * 60 * 1000) return;
            if (!Array.isArray(parsed.items)) return;
            historyPlaceholder.classList.add('hidden');
            parsed.items.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'w-20 h-20 neumorphic-outset p-1 rounded-md flex-shrink-0';
            const historyImg = document.createElement('img');
            historyImg.src = item.url;
            historyImg.setAttribute('data-prompt', item.prompt);
            historyImg.className = 'w-full h-full object-cover rounded-sm cursor-pointer';
            historyImg.onclick = () => showPreviewModal(item.url, item.prompt);
            historyItem.appendChild(historyImg);
            historyContainer.appendChild(historyItem);
            });
        }

        // --- History Function ---
        function addToHistory(imageUrl, prompt) {
            historyPlaceholder.classList.add('hidden');
            const historyItem = document.createElement('div');
            historyItem.className = 'w-20 h-20 neumorphic-outset p-1 rounded-md flex-shrink-0';
            const historyImg = document.createElement('img');
            historyImg.src = imageUrl;
            historyImg.setAttribute('data-prompt', prompt);
            historyImg.className = 'w-full h-full object-cover rounded-sm cursor-pointer';
            historyImg.onclick = () => showPreviewModal(imageUrl, prompt);
            historyItem.appendChild(historyImg);
            historyContainer.prepend(historyItem);
            saveHistoryToStorage();
        }

        // --- History Grid Modal ---
        // Create button and modal if not exist
        (function() {
            // Button
            let btn = document.getElementById('show-history-grid-btn');
            if (!btn) {
            btn = document.createElement('button');
            btn.id = 'show-history-grid-btn';
            btn.title = 'Lihat Semua History';
            btn.className = 'absolute top-2 right-2 z-10 p-2 bg-white dark:bg-red-900 rounded-full shadow hover:bg-gray-500 transition-colors';
            btn.innerHTML = '<i class="ph-fill ph-images text-white text-xl theme-3d theme-glass"></i>';
            historyContainer.parentElement.style.position = 'relative';
            historyContainer.parentElement.appendChild(btn);
            }
            // Modal
            let modal = document.getElementById('history-grid-modal');
            if (!modal) {
            modal = document.createElement('div');
            modal.id = 'history-grid-modal';
            modal.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] hidden';
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-auto relative theme-3d theme-glass">
                <button id="close-history-grid-modal" class="absolute top-2 right-2 p-2 rounded-full hover:bg-red-500 dark:hover:bg-red-500 theme-btn theme-3d theme-glass">
                    <i class="ph ph-x text-xl"></i>
                </button>
                <h2 class="text-lg font-bold mb-4 flex items-center gap-2 theme-text theme-3d theme-glass"><i class="ph-fill ph-images"></i> Semua History Gambar</h2>
                <div id="history-grid-content" class="grid grid-cols-2 md:grid-cols-4 gap-4 theme-3d theme-glass"></div>
                <div id="history-preview-container" class="mt-6 hidden theme-3d theme-glass">
                    <div class="flex flex-col items-center">
                    <img id="history-preview-image" class="max-w-full max-h-96 rounded-lg shadow mb-4 theme-3d theme-glass" />
                    <div id="history-preview-prompt" class="theme-text text-sm text-center theme-3d theme-glass"></div>
                    </div>
                </div>
                </div>
            `;
            document.body.appendChild(modal);
            }
            // Button click
            btn.onclick = async function() {
            // Load from storage (always fresh)
            const data = localStorage.getItem('tkk-history');
            let parsed = null;
            try { parsed = JSON.parse(data); } catch {}
            const ip = await getUserIP();
            const grid = modal.querySelector('#history-grid-content');
            const previewContainer = modal.querySelector('#history-preview-container');
            const previewImage = modal.querySelector('#history-preview-image');
            const previewPrompt = modal.querySelector('#history-preview-prompt');
            grid.innerHTML = '';
            previewContainer.classList.add('hidden');
            if (!parsed || parsed.ip !== ip || Date.now() - parsed.ts > 24 * 60 * 60 * 1000 || !Array.isArray(parsed.items) || !parsed.items.length) {
                grid.innerHTML = '<div class="col-span-4 text-center text-gray-500">Belum ada history gambar.</div>';
            } else {
                parsed.items.forEach(item => {
                const slot = document.createElement('div');
                slot.className = 'relative group';
                slot.innerHTML = `
                    <img src="${item.url}" class="w-full h-32 object-cover rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer" />
                    <button class="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition"><i class="ph ph-eye"></i></button>
                `;
                // Preview on click (show below grid)
                slot.querySelector('img').onclick = () => {
                    previewImage.src = item.url;
                    previewPrompt.textContent = item.prompt;
                    previewContainer.classList.remove('hidden');
                };
                slot.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    previewImage.src = item.url;
                    previewPrompt.textContent = item.prompt;
                    previewContainer.classList.remove('hidden');
                };
                grid.appendChild(slot);
                });
            }
            modal.classList.remove('hidden');
            };
            // Close modal
            modal.querySelector('#close-history-grid-modal').onclick = () => modal.classList.add('hidden');
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
        })();

        // On load, restore history
        window.addEventListener('DOMContentLoaded', () => {
            loadHistoryFromStorage();
        });

        // --- API Call Helpers & Prompt Actions ---
        enhanceBtn.addEventListener('click', async () => {
            const currentPrompt = promptInput.value.trim();
            if (!currentPrompt) { showInfoModal('Prompt Kosong', 'Mohon masukkan ide prompt.'); return; }
            loadingText.textContent = "Meningkatkan prompt...";
            loadingIndicator.classList.remove('hidden');
            toggleButtons(true);
            try {
                const instruction = `Please enhance the following image generation prompt to be more descriptive, vivid, and artistic. Respond only with the enhanced prompt, without any additional text, explanation, or quotation marks. The original prompt is: "${currentPrompt}"`;
                const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(instruction)}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Gagal menghubungi server: ${response.status}`);
                const enhancedPrompt = await response.text();
                promptInput.value = enhancedPrompt.trim().replace(/^"|"$/g, '');
            } catch (error) { showInfoModal('Gagal Meningkatkan', error.message); } 
            finally { loadingIndicator.classList.add('hidden'); toggleButtons(false); }
        });
        
        ideaBtn.addEventListener('click', async () => {
            loadingText.textContent = "Mencari ide...";
            loadingIndicator.classList.remove('hidden');
            toggleButtons(true);
            try {
                const instruction = "Berikan satu ide prompt yang sangat kreatif dan tak terduga untuk generator gambar AI. Fokus pada konsep unik yang menggabungkan elemen yang tidak biasa. Berikan hanya promptnya, tanpa awalan atau penjelasan.";
                const seed = Math.random();
                const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(instruction)}?seed=${seed}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Gagal menghubungi server: ${response.status}`);
                const idea = await response.text();
                promptInput.value = idea.trim().replace(/"/g, '');
            } catch (error) { 
                console.error('Error getting idea:', error);
                showInfoModal('Gagal Mendapat Ide', error.message); 
            } finally { 
                loadingIndicator.classList.add('hidden'); 
                toggleButtons(false); 
            }
        });
        
        copyBtn.addEventListener('click', () => {
            if (!promptInput.value) {
                showInfoModal('Prompt Kosong', 'Tidak ada teks untuk disalin.');
                return;
            }
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = promptInput.value;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextArea);
            
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `<i class="ph-fill ph-check-circle"></i><span>Disalin!</span>`;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        });

        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                promptInput.value += text;
            } catch (err) {
                showInfoModal('Gagal Menempel', 'Browser Anda mungkin tidak mendukung fitur ini atau izin belum diberikan.');
                console.error('Failed to read clipboard contents: ', err);
            }
        });

        clearBtn.addEventListener('click', () => {
            promptInput.value = '';
        });


        // --- Main Feature: Generate Image ---
        async function generateImage(prompt) {
            const promptParts = [
                promptInput.value.trim(),
                modelSelect.value,
                artStyleSelect.value,
                styleSelect.value,
                sizeSelect.value
            ];
            
            const finalPrompt = prompt || promptParts.filter(Boolean).join(', ');

            if (!promptInput.value.trim()) {
                showInfoModal('Prompt Kosong', 'Mohon masukkan deskripsi gambar.');
                return;
            }
            
            loadingText.textContent = "Membuat keajaiban...";
            loadingIndicator.classList.remove('hidden');
            toggleButtons(true);
            
            
            const batchSize = parseInt(batchSelect.value, 10);
            
            imageGrid.innerHTML = '';
            imageGrid.className = batchSize > 1 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4';
            
            console.log("Final prompt:", finalPrompt, "| Batch size:", batchSize);

            try {
                const imagePromises = [];

                let width, height;
                const sizeValue = sizeSelect.value;
                if (sizeValue.includes('16:9')) {
                    width = 1920; height = 1080;
                } else if (sizeValue.includes('9:16')) {
                    width = 1080; height = 1920;
                } else {
                    width = 1024; height = 1024;
                }

                for (let i = 0; i < batchSize; i++) {
                    const encodedPrompt = encodeURIComponent(finalPrompt);
                    const seed = Math.floor(Math.random() * 100000); 
                    const apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
                    imagePromises.push(fetch(apiUrl));
                }

                const responses = await Promise.all(imagePromises);
                
                generatedImagesData = []; // Clear previous data

                responses.forEach((response, index) => {
                    if (response.ok) {
                        const imageUrl = response.url;

                        generatedImagesData.push({ url: imageUrl, prompt: finalPrompt });

                        // Determine layout: for 2-4 images, stack vertically (column), else grid
                        let slot = document.createElement('div');
                        let batchSize = responses.length;
                        if (batchSize === 2) {
                            imageGrid.className = 'flex flex-col gap-4 overflow-auto max-h-[60vh]';
                            slot.className = 'preview-slot aspect-square neumorphic-inset flex items-center justify-center text-center p-2 relative cursor-pointer';
                        } else if (batchSize === 3 || batchSize === 4) {
                            imageGrid.className = 'flex flex-col gap-4 overflow-auto max-h-[60vh]';
                            slot.className = 'preview-slot aspect-square neumorphic-inset flex items-center justify-center text-center p-2 relative cursor-pointer';
                        } else {
                            // fallback to grid for 1 or >4
                            imageGrid.className = batchSize > 1 ? 'grid grid-cols-2 gap-4 overflow-auto max-h-[60vh]' : 'grid grid-cols-1 gap-4 overflow-auto max-h-[60vh]';
                            slot.className = 'preview-slot aspect-square neumorphic-inset flex items-center justify-center text-center p-2 relative cursor-pointer';
                        }

                        slot.innerHTML = `
                            <img src="${imageUrl}" class="generated-image w-full h-full object-contain rounded-md">
                            <button class="download-btn absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/75 transition-colors">
                                <i class="ph-fill ph-download-simple"></i>
                            </button>
                        `;
                        imageGrid.appendChild(slot);

                        slot.querySelector('.download-btn').onclick = async (e) => {
                            e.stopPropagation();
                            await downloadImage(imageUrl, finalPrompt);
                        };

                        slot.onclick = () => showPreviewModal(imageUrl, finalPrompt);
                        addToHistory(imageUrl, finalPrompt);
                    } else {
                        console.error(`Failed to generate image ${index + 1}:`, response.statusText);
                    }
                });
            } catch (error) {
                console.error('Error generating image:', error);
                showInfoModal('Terjadi Kesalahan', error.message || 'Gagal membuat gambar.');
                resetGridToPlaceholder();
            } finally {
                loadingIndicator.classList.add('hidden');
                toggleButtons(false);
            }
        }

        generateBtn.addEventListener('click', () => generateImage());

        // --- Advanced Tools Logic ---
        const toolsContainer = document.getElementById('advanced-tools-container');
        toolsContainer.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-btn');
            if (!toolButton) return;

            const toolName = toolButton.dataset.tool;
            if (!toolName) {
                return;
            }

            // Special check for enhance tool
            if (toolName === 'enhance' && generatedImagesData.length === 0) {
                showInfoModal('Gambar Tidak Ditemukan', 'Anda harus membuat gambar terlebih dahulu sebelum bisa meningkatkannya.');
                return;
            }

            const content = document.getElementById(`tool-content-${toolName}`);
            const wasActive = toolButton.classList.contains('active');

            toolsContainer.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            toolsContainer.querySelectorAll('.tool-content').forEach(c => c.classList.remove('expanded'));

            if (!wasActive) {
                toolButton.classList.add('active');
                if (content) {
                    content.classList.add('expanded');
                    if (toolName === 'enhance') {
                        populateEnhancePanel();
                    }
                }
            }
        });

        // --- Video Prompt Section ---
        const videoIdeaBtn = document.getElementById('video-idea-btn');
        const videoPromptMain = document.getElementById('video-prompt-main');

        videoIdeaBtn.addEventListener('click', async () => {
            loadingText.textContent = "Membuat skenario...";
            loadingIndicator.classList.remove('hidden');
            videoIdeaBtn.disabled = true;
            try {
                const instruction = "Berikan satu ide skenario video yang detail dan sinematik. Fokus pada deskripsi visual, atmosfer, dan aksi. Berikan hanya skenarionya, tanpa awalan atau penjelasan.";
                const seed = Math.random();
                const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(instruction)}?seed=${seed}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Gagal menghubungi server: ${response.status}`);
                const idea = await response.text();
                videoPromptMain.value = idea.trim().replace(/"/g, '');
            } catch (error) {
                console.error('Error getting video idea:', error);
                showInfoModal('Gagal Mendapat Ide Video', error.message);
            } finally {
                loadingIndicator.classList.add('hidden');
                videoIdeaBtn.disabled = false;
            }
        });

        document.getElementById('download-video-prompt-btn').addEventListener('click', () => {
            const mainIdea = document.getElementById('video-prompt-main').value;
            const style = document.getElementById('video-style').value;
            const angle = document.getElementById('video-angle').value;
            const movement = document.getElementById('video-movement').value;
            const duration = document.getElementById('video-duration').value;

            if (!mainIdea) {
                showInfoModal('Prompt Kosong', 'Mohon isi ide utama untuk video.');
                return;
            }

const fullPrompt = `
SCENE: ${mainIdea}.
VISUAL STYLE: ${style}.
CAMERA: ${angle}, ${movement}.
DURATION: ${duration}.
`.trim();

            const blob = new Blob([fullPrompt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'prompt-video.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
        
        // --- Audio Tool Section ---
        const audioVoiceModelSelect = document.getElementById('audio-voice-model');
        const audioNarration = document.getElementById('audio-narration');
        const audioCharacter = document.getElementById('audio-character');
        const audioIdeaBtn = document.getElementById('audio-idea-btn');
        const generateAudioBtn = document.getElementById('generate-audio-btn');
        const clearAudioBtn = document.getElementById('clear-audio-btn');
        const audioResultContainer = document.getElementById('audio-result-container');

        const voiceModels = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse', 'ballad', 'ash', 'sage', 'amuch', 'aster', 'brook', 'clover', 'dan', 'elan', 'marilyn', 'meadow', 'jazz', 'rio'];
        voiceModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model.charAt(0).toUpperCase() + model.slice(1);
            audioVoiceModelSelect.appendChild(option);
        });

        audioIdeaBtn.addEventListener('click', async () => {
            const character = audioCharacter.value.trim() || 'seorang narator';
            loadingText.textContent = "Membuat narasi...";
            loadingIndicator.classList.remove('hidden');
            audioIdeaBtn.disabled = true;
            try {
                const instruction = `Buatkan sebuah narasi singkat dengan karakter suara seperti ${character}. Berikan hanya narasinya, tanpa awalan atau penjelasan.`;
                const seed = Math.random();
                const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(instruction)}?seed=${seed}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Gagal menghubungi server: ${response.status}`);
                const idea = await response.text();
                audioNarration.value = idea.trim().replace(/"/g, '');
            } catch (error) {
                console.error('Error getting audio idea:', error);
                showInfoModal('Gagal Mendapat Ide Narasi', error.message);
            } finally {
                loadingIndicator.classList.add('hidden');
                audioIdeaBtn.disabled = false;
            }
        });

        generateAudioBtn.addEventListener('click', async () => {
            const textToSpeak = audioNarration.value.trim();
            if (!textToSpeak) {
                showInfoModal('Teks Kosong', 'Mohon masukkan teks narasi yang ingin diubah menjadi suara.');
                return;
            }

            const btnText = generateAudioBtn.querySelector('.btn-text');
            const btnSpinner = generateAudioBtn.querySelector('svg');

            btnText.classList.add('hidden');
            btnSpinner.classList.remove('hidden');
            generateAudioBtn.disabled = true;
            audioResultContainer.classList.add('hidden');
            audioResultContainer.innerHTML = '';

            try {
                const systemPrompt = "You are a text-to-speech agent. Do not comment, do not respond. Only read aloud the text exactly as written, with no additions. The input is: ";
                const finalPrompt = systemPrompt + textToSpeak;
                const selectedVoice = audioVoiceModelSelect.value;
                const encodedPrompt = encodeURIComponent(finalPrompt);
                const apiUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai-audio&voice=${selectedVoice}&token=IU6OBB-pF3hKZVWC`;
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`Gagal membuat audio: ${response.statusText}`);
                }
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                const audioPlayer = document.createElement('audio');
                audioPlayer.controls = true;
                audioPlayer.src = audioUrl;
                
                const downloadLink = document.createElement('a');
                downloadLink.href = audioUrl;
                downloadLink.download = 'audio-narasi.mp3';
                downloadLink.innerHTML = `<i class="ph-fill ph-download-simple text-xl"></i>`;
                downloadLink.className = 'neumorphic-outset-interactive p-2 rounded-full';

                const playerWrapper = document.createElement('div');
                playerWrapper.className = 'flex items-center gap-4 mt-2';
                playerWrapper.appendChild(audioPlayer);
                playerWrapper.appendChild(downloadLink);

                audioResultContainer.appendChild(playerWrapper);
                audioResultContainer.classList.remove('hidden');

            } catch (error) {
                console.error('Error generating audio:', error);
                showInfoModal('Gagal Membuat Audio', error.message);
            } finally {
                btnText.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
                generateAudioBtn.disabled = false;
            }
        });
        
        clearAudioBtn.addEventListener('click', () => {
            audioCharacter.value = '';
            audioNarration.value = '';
            audioResultContainer.classList.add('hidden');
            audioResultContainer.innerHTML = '';
        });

        // --- Enhance Tool Section ---
        const enhanceThumbnails = document.getElementById('enhance-thumbnails');
        const enhanceOptionsContainer = document.getElementById('enhance-options-container');
        const enhancePreview = document.getElementById('enhance-preview');
        const runEnhanceBtn = document.getElementById('run-enhance-btn');
        const enhanceResultContainer = document.getElementById('enhance-result-container');
        const beforeImage = document.getElementById('before-image');
        const afterCanvas = document.getElementById('after-canvas');
        const downloadEnhancedBtn = document.getElementById('download-enhanced-btn');

        function populateEnhancePanel() {
            enhanceThumbnails.innerHTML = '';
            enhanceOptionsContainer.classList.add('hidden');
            enhanceResultContainer.classList.add('hidden');
            selectedForEnhancement = null;

            generatedImagesData.forEach((imgData, index) => {
                const thumb = document.createElement('img');
                thumb.src = imgData.url;
                thumb.className = 'w-16 h-16 object-cover rounded-md cursor-pointer enhance-thumbnail';
                thumb.onclick = () => selectImageForEnhancement(index, thumb);
                enhanceThumbnails.appendChild(thumb);
            });
        }

        function selectImageForEnhancement(index, thumbElement) {
            enhanceThumbnails.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
            thumbElement.classList.add('selected');

            selectedForEnhancement = generatedImagesData[index];
            enhancePreview.src = selectedForEnhancement.url;
            enhanceOptionsContainer.classList.remove('hidden');
        }
        
        function applyFilter(originalImageSrc, filterType) {
             return new Promise((resolve, reject) => {
                const canvas = afterCanvas;
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = originalImageSrc;
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    let filterString = '';
                    switch(filterType) {
                        case 'sharpen':
                            filterString = 'contrast(1.2) saturate(1.1)';
                            break;
                        case 'grayscale':
                            filterString = 'grayscale(100%)';
                            break;
                        case 'sepia':
                            filterString = 'sepia(100%)';
                            break;
                        case 'invert':
                            filterString = 'invert(100%)';
                            break;
                        case 'vintage':
                            filterString = 'sepia(60%) contrast(1.1) brightness(0.9) saturate(1.2)';
                            break;
                        case 'high-contrast':
                            filterString = 'contrast(1.5) saturate(1.2)';
                            break;
                        default:
                            filterString = 'none';
                            break;
                    }
                    
                    ctx.filter = filterString;
                    ctx.drawImage(img, 0, 0);
                    
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = (err) => {
                    console.error("Image loading error for canvas:", err);
                    reject(err);
                };
            });
        }
        
        runEnhanceBtn.addEventListener('click', async () => {
            if (!selectedForEnhancement) {
                showInfoModal('Pilih Gambar', 'Silakan pilih gambar yang ingin ditingkatkan terlebih dahulu.');
                return;
            }
            loadingText.textContent = "Menerapkan filter...";
            loadingIndicator.classList.remove('hidden');
            runEnhanceBtn.disabled = true;

            try {
                const selectedFilter = document.getElementById('enhance-filter-select').value;
                const originalImageUrl = selectedForEnhancement.url;

                const sharpenedImageUrl = await applyFilter(originalImageUrl, selectedFilter);
                
                beforeImage.src = originalImageUrl;
                
                enhanceResultContainer.classList.remove('hidden');
                
                downloadEnhancedBtn.onclick = () => downloadImage(sharpenedImageUrl, "enhanced-" + selectedForEnhancement.prompt);

            } catch (error) {
                console.error("Enhance error:", error);
                showInfoModal("Gagal Meningkatkan", "Terjadi kesalahan saat menerapkan filter. Pastikan gambar dapat diakses.");
            } finally {
                loadingIndicator.classList.add('hidden');
                runEnhanceBtn.disabled = false;
            }
        });

        // --- Theme Toggle Logic ---
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            
            const isDarkMode = document.body.classList.contains('dark-mode');
            if (isDarkMode) {
            themeIcon.className = 'ph ph-moon text-xl text-indigo-400';
            themeText.textContent = 'Dark Mode';
            } else {
            themeIcon.className = 'ph ph-sun text-xl text-amber-500';
            themeText.textContent = 'Light Mode';
            }
        });

        // Auto switch to dark mode on load
        window.addEventListener('DOMContentLoaded', () => {
            if (!document.body.classList.contains('dark-mode')) {
            themeToggle.click();
            }
        });

/* === CHAT ASSISTANT LOGIC === *///script 2

                            (function() {
                                // --- Chat Assistant Variables ---
                                const chatBtn = document.querySelector('.tool-btn[data-tool="chat"]');
                                const chatContent = document.getElementById('tool-content-chat');
                                const chatMessages = document.getElementById('chat-messages');
                                const chatForm = document.getElementById('chat-form');
                                const chatInput = document.getElementById('chat-input');
                                let chatHistory = [
                                    {
                                        role: "system",
                                        content: "Kamu adalah asisten AI yang hanya membantu membuat prompt untuk image generation model flux, turbo, dan gptimage. Jawab hanya seputar pembuatan prompt, jangan menjawab hal lain."
                                    }
                                ];

                                // --- Expand on Click (handled by global logic) ---

                                // --- Render Chat Messages ---
                                function renderChat() {
                                    chatMessages.innerHTML = '';
                                    chatHistory.forEach((msg, idx) => {
                                        if (msg.role === 'system') return;
                                        const div = document.createElement('div');
                                        div.className = msg.role === 'user'
                                            ? 'text-right'
                                            : 'text-left';
                                        if (msg.role === 'user') {
                                            div.innerHTML = `<span class="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded px-3 py-2">${msg.content}</span>`;
                                        } else {
                                            // Check if bot gives a prompt (simple heuristic: contains "prompt:" or looks like a prompt)
                                            let promptMatch = msg.content.match(/prompt\s*:\s*(.+)/i);
                                            let promptText = promptMatch ? promptMatch[1] : '';
                                            // If not found, try to detect a single-line prompt
                                            if (!promptText && msg.content.length < 300) promptText = msg.content;
                                            if (promptText && promptText.length > 5) {
                                                div.innerHTML = `
                                                    <span class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-3 py-2">${msg.content}</span>
                                                    <div class="mt-2">
                                                        <button class="btn btn-secondary btn-use-prompt text-xs px-3 py-1" data-prompt="${encodeURIComponent(promptText)}">
                                                            <i class="ph-fill ph-arrow-fat-line-right"></i> Use Prompt
                                                        </button>
                                                    </div>
                                                `;
                                            } else {
                                                div.innerHTML = `<span class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-3 py-2">${msg.content}</span>`;
                                            }
                                        }
                                        chatMessages.appendChild(div);
                                    });
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }

                                // --- Handle Use Prompt Button ---
                                // Always render the Use Prompt button, even if promptText is short
                                chatMessages.addEventListener('click', function(e) {
                                    const btn = e.target.closest('.btn-use-prompt');
                                    if (!btn) return;
                                    const prompt = decodeURIComponent(btn.dataset.prompt || '');
                                    const promptInput = document.getElementById('prompt-input');
                                    if (promptInput) {
                                        promptInput.value = prompt;
                                        showInfoModal('Prompt Ditempel', 'Prompt dari asisten telah ditempel ke area utama.');
                                    }
                                });

                                // Patch renderChat to always show Use Prompt button for assistant messages
                                const originalRenderChat = renderChat;
                                function renderChat() {
                                    chatMessages.innerHTML = '';
                                    chatHistory.forEach((msg, idx) => {
                                        if (msg.role === 'system') return;
                                        const div = document.createElement('div');
                                        div.className = msg.role === 'user'
                                            ? 'text-right'
                                            : 'text-left';
                                        if (msg.role === 'user') {
                                            div.innerHTML = `<span class="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded px-3 py-2">${msg.content}</span>`;
                                        } else {
                                            // Always show Use Prompt button for assistant
                                            const promptText = msg.content;
                                            div.innerHTML = `
                                                <span class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-3 py-2">${msg.content}</span>
                                                <div class="mt-2">
                                                    <button class="btn btn-secondary btn-use-prompt text-xs px-3 py-1" data-prompt="${encodeURIComponent(promptText)}">
                                                        <i class="ph-fill ph-arrow-fat-line-right"></i> Use Prompt
                                                    </button>
                                                </div>
                                            `;
                                        }
                                        chatMessages.appendChild(div);
                                    });
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }

                                // --- Handle Chat Submit ---
                                chatForm.addEventListener('submit', async function(e) {
                                    e.preventDefault();
                                    const userMsg = chatInput.value.trim();
                                    if (!userMsg) return;
                                    chatHistory.push({ role: "user", content: userMsg });
                                    renderChat();
                                    chatInput.value = '';
                                    // Show loading
                                    const loadingDiv = document.createElement('div');
                                    loadingDiv.className = 'text-left';
                                    loadingDiv.innerHTML = `<span class="inline-block bg-gray-200 dark:bg-gray-700 text-gray-500 rounded px-3 py-2 animate-pulse">Mengetik...</span>`;
                                    chatMessages.appendChild(loadingDiv);
                                    chatMessages.scrollTop = chatMessages.scrollHeight;

                                    try {
                                        const res = await fetch('https://text.pollinations.ai/openai', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                messages: chatHistory,
                                                system: "Kamu adalah asisten AI yang hanya membantu membuat prompt untuk image generation model flux, turbo, dan gptimage. Jawab hanya seputar pembuatan prompt, jangan menjawab hal lain."
                                            })
                                        });
                                        if (!res.ok) throw new Error('Gagal menghubungi asisten.');
                                        const data = await res.json();
                                        let botMsg = (data.choices?.[0]?.message?.content || '').trim();
                                        if (!botMsg) botMsg = "Maaf, saya tidak dapat memproses permintaan Anda.";
                                        chatHistory.push({ role: "assistant", content: botMsg });
                                    } catch (err) {
                                        chatHistory.push({ role: "assistant", content: "Terjadi kesalahan: " + err.message });
                                    }
                                    renderChat();
                                });

                                // --- Auto focus input when expanded ---
                                chatBtn && chatBtn.addEventListener('click', () => {
                                    setTimeout(() => { chatInput && chatInput.focus(); }, 300);
                                });

                                // --- Initial render ---
                                renderChat();
                            })();
                            
    // === CHAT INFINITE SCROLL LOGIC ===

    
                                (function() {
                                    // Infinite scroll for chat-messages
                                    const chatMessages = document.getElementById('chat-messages');
                                    let isLoadingOlder = false;
                                    let chatHistory = [
                                        {
                                            role: "system",
                                            content: "Kamu adalah asisten AI yang hanya membantu membuat prompt untuk image generation model flux, turbo, dan gptimage. Jawab hanya seputar pembuatan prompt, jangan menjawab hal lain."
                                        }
                                    ];
                                    let oldestIndex = 0; // Track how many messages are loaded

                                    // Save original renderChat
                                    const originalRenderChat = window.renderChat || function() {};

                                    function renderChat(limit = 20, append = false) {
                                        // Only show the last N messages (excluding system)
                                        const userAssistantMsgs = chatHistory.filter(msg => msg.role !== 'system');
                                        const start = Math.max(0, userAssistantMsgs.length - oldestIndex - limit);
                                        const end = userAssistantMsgs.length - oldestIndex;
                                        const msgsToShow = userAssistantMsgs.slice(start, end);

                                        if (!append) chatMessages.innerHTML = '';
                                        msgsToShow.forEach((msg, idx) => {
                                            const div = document.createElement('div');
                                            div.className = msg.role === 'user'
                                                ? 'text-right'
                                                : 'text-left';
                                            if (msg.role === 'user') {
                                                div.innerHTML = `<span class="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded px-3 py-2">${msg.content}</span>`;
                                            } else {
                                                let promptMatch = msg.content.match(/prompt\s*:\s*(.+)/i);
                                                let promptText = promptMatch ? promptMatch[1] : '';
                                                if (!promptText && msg.content.length < 300) promptText = msg.content;
                                                if (promptText && promptText.length > 5) {
                                                    div.innerHTML = `
                                                        <span class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-3 py-2">${msg.content}</span>
                                                        <div class="mt-2">
                                                            <button class="btn btn-secondary btn-use-prompt text-xs px-3 py-1" data-prompt="${encodeURIComponent(promptText)}">
                                                                <i class="ph-fill ph-arrow-fat-line-right"></i> Use Prompt
                                                            </button>
                                                        </div>
                                                    `;
                                                } else {
                                                    div.innerHTML = `<span class="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded px-3 py-2">${msg.content}</span>`;
                                                }
                                            }
                                            if (append) {
                                                chatMessages.insertBefore(div, chatMessages.firstChild);
                                            } else {
                                                chatMessages.appendChild(div);
                                            }
                                        });
                                        if (!append) chatMessages.scrollTop = chatMessages.scrollHeight;
                                    }

                                    // Initial render
                                    renderChat();

                                    // Infinite scroll logic
                                    chatMessages.addEventListener('scroll', async function() {
                                        if (chatMessages.scrollTop <= 10 && !isLoadingOlder) {
                                            isLoadingOlder = true;
                                            const prevHeight = chatMessages.scrollHeight;
                                            const more = 20;
                                            const userAssistantMsgs = chatHistory.filter(msg => msg.role !== 'system');
                                            if (oldestIndex + more < userAssistantMsgs.length) {
                                                oldestIndex += more;
                                                renderChat(more, true);
                                                // Restore scroll position after prepend
                                                setTimeout(() => {
                                                    chatMessages.scrollTop = chatMessages.scrollHeight - prevHeight;
                                                    isLoadingOlder = false;
                                                }, 0);
                                            } else {
                                                // If all messages loaded, do nothing
                                                isLoadingOlder = false;
                                            }
                                        }
                                    });
                                    // Always allow vertical scroll, even on small screens
                                    chatMessages.style.overflowY = "auto";
                                    chatMessages.style.maxHeight = "100%";
                                    chatMessages.style.minHeight = "0";

                                    // Patch global renderChat to support new logic
                                    window.renderChat = function() {
                                        oldestIndex = 0;
                                        renderChat();
                                    };

                                    // Patch chatHistory usage in chat assistant logic
                                    window.getChatHistory = () => chatHistory;
                                    window.setChatHistory = (h) => { chatHistory = h; window.renderChat(); };

                                    // If chat assistant logic uses its own chatHistory, sync it
                                    // (If not, you can remove these lines)
                                    if (window.chatHistory) {
                                        chatHistory = window.chatHistory;
                                    }
                                    window.chatHistory = chatHistory;
                                })();

    /* === WATERMARK TOOL LOGIC === *///script 4
                            (function() {
                                // --- Watermark Tool Variables ---
                                let selectedWatermarkImage = null;
                                let watermarkLogoImg = null;
                                let watermarkAnchor = "bottomright";
                                let watermarkLogoDataUrl = "";
                                const watermarkThumbnails = document.getElementById('watermark-thumbnails');
                                const watermarkOptionsContainer = document.getElementById('watermark-options-container');
                                const watermarkPreviewContainer = document.getElementById('watermark-preview-container');
                                const watermarkCanvas = document.getElementById('watermark-canvas');
                                const watermarkText = document.getElementById('watermark-text');
                                const watermarkFontsize = document.getElementById('watermark-fontsize');
                                const watermarkFontsizeValue = document.getElementById('watermark-fontsize-value');
                                const watermarkOpacity = document.getElementById('watermark-opacity');
                                const watermarkOpacityValue = document.getElementById('watermark-opacity-value');
                                const watermarkColor = document.getElementById('watermark-color');
                                const watermarkFontfamily = document.getElementById('watermark-fontfamily');
                                const watermarkLogoUpload = document.getElementById('watermark-logo-upload');
                                const watermarkLogoPreview = document.getElementById('watermark-logo-preview');
                                const watermarkRemoveLogo = document.getElementById('watermark-remove-logo');
                                const watermarkLogoSize = document.getElementById('watermark-logo-size');
                                const watermarkLogoSizeValue = document.getElementById('watermark-logo-size-value');
                                const watermarkLogoOpacity = document.getElementById('watermark-logo-opacity');
                                const watermarkLogoOpacityValue = document.getElementById('watermark-logo-opacity-value');
                                const watermarkAnchorGrid = document.getElementById('watermark-anchor-grid');
                                const downloadWatermarkBtn = document.getElementById('download-watermark-btn');
                                const clearWatermarkBtn = document.getElementById('clear-watermark-btn');

                                // --- Populate Thumbnails ---
                                function populateWatermarkPanel() {
                                    watermarkThumbnails.innerHTML = '';
                                    watermarkOptionsContainer.classList.add('hidden');
                                    watermarkPreviewContainer.classList.add('hidden');
                                    selectedWatermarkImage = null;
                                    watermarkLogoDataUrl = "";
                                    watermarkLogoPreview.src = "";
                                    watermarkLogoPreview.classList.add('hidden');
                                    watermarkRemoveLogo.classList.add('hidden');
                                    watermarkText.value = "";
                                    watermarkFontsize.value = 36;
                                    watermarkFontsizeValue.textContent = "36px";
                                    watermarkOpacity.value = 40;
                                    watermarkOpacityValue.textContent = "40%";
                                    watermarkColor.value = "#ffffff";
                                    watermarkFontfamily.value = "Arial";
                                    watermarkLogoSize.value = 30;
                                    watermarkLogoSizeValue.textContent = "30%";
                                    watermarkLogoOpacity.value = 40;
                                    watermarkLogoOpacityValue.textContent = "40%";
                                    watermarkAnchor = "bottomright";
                                    watermarkAnchorGrid.querySelectorAll('.anchor-btn').forEach(btn => btn.classList.remove('bg-indigo-200'));
                                    watermarkAnchorGrid.querySelector('[data-anchor="bottomright"]').classList.add('bg-indigo-200');
                                    generatedImagesData.forEach((imgData, index) => {
                                        const thumb = document.createElement('img');
                                        thumb.src = imgData.url;
                                        thumb.className = 'w-16 h-16 object-cover rounded-md cursor-pointer enhance-thumbnail';
                                        thumb.onclick = () => selectImageForWatermark(index, thumb);
                                        watermarkThumbnails.appendChild(thumb);
                                    });
                                }

                                // --- Select Image for Watermark ---
                                function selectImageForWatermark(index, thumbElement) {
                                    watermarkThumbnails.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
                                    thumbElement.classList.add('selected');
                                    selectedWatermarkImage = generatedImagesData[index];
                                    watermarkOptionsContainer.classList.remove('hidden');
                                    watermarkPreviewContainer.classList.remove('hidden');
                                    renderWatermarkPreview();
                                }

                                // --- Logo Upload ---
                                watermarkLogoUpload.addEventListener('change', function(e) {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = function(evt) {
                                        watermarkLogoDataUrl = evt.target.result;
                                        watermarkLogoPreview.src = watermarkLogoDataUrl;
                                        watermarkLogoPreview.classList.remove('hidden');
                                        watermarkRemoveLogo.classList.remove('hidden');
                                        renderWatermarkPreview();
                                    };
                                    reader.readAsDataURL(file);
                                });
                                watermarkRemoveLogo.addEventListener('click', function() {
                                    watermarkLogoDataUrl = "";
                                    watermarkLogoPreview.src = "";
                                    watermarkLogoPreview.classList.add('hidden');
                                    watermarkRemoveLogo.classList.add('hidden');
                                    watermarkLogoUpload.value = "";
                                    renderWatermarkPreview();
                                });

                                // --- Anchor Position ---
                                watermarkAnchorGrid.addEventListener('click', function(e) {
                                    const btn = e.target.closest('.anchor-btn');
                                    if (!btn) return;
                                    watermarkAnchor = btn.dataset.anchor;
                                    watermarkAnchorGrid.querySelectorAll('.anchor-btn').forEach(b => b.classList.remove('bg-indigo-200'));
                                    btn.classList.add('bg-indigo-200');
                                    renderWatermarkPreview();
                                });

                                // --- Sliders & Inputs Realtime Update ---
                                [watermarkText, watermarkFontsize, watermarkOpacity, watermarkColor, watermarkFontfamily, watermarkLogoSize, watermarkLogoOpacity].forEach(el => {
                                    el.addEventListener('input', renderWatermarkPreview);
                                });
                                watermarkFontsize.addEventListener('input', () => watermarkFontsizeValue.textContent = watermarkFontsize.value + "px");
                                watermarkOpacity.addEventListener('input', () => watermarkOpacityValue.textContent = watermarkOpacity.value + "%");
                                watermarkLogoSize.addEventListener('input', () => watermarkLogoSizeValue.textContent = watermarkLogoSize.value + "%");
                                watermarkLogoOpacity.addEventListener('input', () => watermarkLogoOpacityValue.textContent = watermarkLogoOpacity.value + "%");
                                watermarkFontfamily.addEventListener('change', renderWatermarkPreview);

                                // --- Render Watermark Preview ---
                                async function renderWatermarkPreview() {
                                    if (!selectedWatermarkImage) return;
                                    const img = new Image();
                                    img.crossOrigin = "Anonymous";
                                    img.src = selectedWatermarkImage.url;
                                    img.onload = async function() {
                                        watermarkCanvas.width = img.width;
                                        watermarkCanvas.height = img.height;
                                        const ctx = watermarkCanvas.getContext('2d');
                                        ctx.clearRect(0, 0, img.width, img.height);
                                        ctx.drawImage(img, 0, 0);

                                        // Draw Logo if exists
                                        if (watermarkLogoDataUrl) {
                                            const logoImg = new Image();
                                            logoImg.src = watermarkLogoDataUrl;
                                            await new Promise(resolve => { logoImg.onload = resolve; });
                                            // Logo size
                                            const scale = watermarkLogoSize.value / 100;
                                            const logoW = img.width * scale;
                                            const logoH = logoImg.height * (logoW / logoImg.width);
                                            const [x, y] = getAnchorPosition(img.width, img.height, logoW, logoH, watermarkAnchor, 10);
                                            ctx.globalAlpha = watermarkLogoOpacity.value / 100;
                                            ctx.drawImage(logoImg, x, y, logoW, logoH);
                                            ctx.globalAlpha = 1;
                                        }

                                        // Draw Text if exists
                                        if (watermarkText.value.trim()) {
                                            ctx.save();
                                            ctx.font = `${watermarkFontsize.value}px "${watermarkFontfamily.value}", Arial, sans-serif`;
                                            ctx.fillStyle = watermarkColor.value;
                                            ctx.globalAlpha = watermarkOpacity.value / 100;
                                            ctx.textBaseline = "top";
                                            const text = watermarkText.value.trim();
                                            const textMetrics = ctx.measureText(text);
                                            const textW = textMetrics.width;
                                            const textH = watermarkFontsize.value * 1.2;
                                            const [x, y] = getAnchorPosition(img.width, img.height, textW, textH, watermarkAnchor, 10);
                                            ctx.fillText(text, x, y);
                                            ctx.globalAlpha = 1;
                                            ctx.restore();
                                        }
                                    };
                                }

                                // --- Anchor Position Helper ---
                                function getAnchorPosition(imgW, imgH, objW, objH, anchor, margin) {
                                    let x = 0, y = 0;
                                    switch (anchor) {
                                        case "topleft": x = margin; y = margin; break;
                                        case "top": x = (imgW - objW) / 2; y = margin; break;
                                        case "topright": x = imgW - objW - margin; y = margin; break;
                                        case "left": x = margin; y = (imgH - objH) / 2; break;
                                        case "center": x = (imgW - objW) / 2; y = (imgH - objH) / 2; break;
                                        case "right": x = imgW - objW - margin; y = (imgH - objH) / 2; break;
                                        case "bottomleft": x = margin; y = imgH - objH - margin; break;
                                        case "bottom": x = (imgW - objW) / 2; y = imgH - objH - margin; break;
                                        case "bottomright": x = imgW - objW - margin; y = imgH - objH - margin; break;
                                    }
                                    return [x, y];
                                }

                                // --- Download Watermarked Image ---
                                downloadWatermarkBtn.addEventListener('click', function() {
                                    if (!selectedWatermarkImage) return;
                                    const link = document.createElement('a');
                                    link.href = watermarkCanvas.toDataURL('image/png');
                                    link.download = 'tkk-imagen-watermarked.png';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                });

                                // --- Clear Watermark Tool ---
                                clearWatermarkBtn.addEventListener('click', function() {
                                    watermarkText.value = "";
                                    watermarkFontsize.value = 36;
                                    watermarkFontsizeValue.textContent = "36px";
                                    watermarkOpacity.value = 40;
                                    watermarkOpacityValue.textContent = "40%";
                                    watermarkColor.value = "#ffffff";
                                    watermarkFontfamily.value = "Arial";
                                    watermarkLogoSize.value = 30;
                                    watermarkLogoSizeValue.textContent = "30%";
                                    watermarkLogoOpacity.value = 40;
                                    watermarkLogoOpacityValue.textContent = "40%";
                                    watermarkLogoDataUrl = "";
                                    watermarkLogoPreview.src = "";
                                    watermarkLogoPreview.classList.add('hidden');
                                    watermarkRemoveLogo.classList.add('hidden');
                                    watermarkLogoUpload.value = "";
                                    watermarkAnchor = "bottomright";
                                    watermarkAnchorGrid.querySelectorAll('.anchor-btn').forEach(b => b.classList.remove('bg-indigo-200'));
                                    watermarkAnchorGrid.querySelector('[data-anchor="bottomright"]').classList.add('bg-indigo-200');
                                    renderWatermarkPreview();
                                });

                                // --- Tool Activation Logic ---
                                const toolsContainer = document.getElementById('advanced-tools-container');
                                toolsContainer.addEventListener('click', (e) => {
                                    const toolButton = e.target.closest('.tool-btn');
                                    if (!toolButton) return;
                                    const toolName = toolButton.dataset.tool;
                                    if (toolName === 'watermark') {
                                        if (generatedImagesData.length === 0) {
                                            showInfoModal('Gambar Tidak Ditemukan', 'Anda harus membuat gambar terlebih dahulu sebelum bisa menambahkan watermark.');
                                            return;
                                        }
                                        populateWatermarkPanel();
                                    }
                                });

                                // --- Realtime Preview on Option Change ---
                                [
                                    watermarkText, watermarkFontsize, watermarkOpacity, watermarkColor, watermarkFontfamily,
                                    watermarkLogoSize, watermarkLogoOpacity
                                ].forEach(el => el.addEventListener('input', renderWatermarkPreview));
                                watermarkLogoUpload.addEventListener('change', renderWatermarkPreview);

                            })();
                            
                           
                                
                                    // ... openrouter key ...
                                (function() {
                                    const uploadInput = document.getElementById('upscale-image-upload');
                                    const previewImg = document.getElementById('upscale-image-preview');
                                    const removeBtn = document.getElementById('upscale-remove-image');
                                    const generateBtn = document.getElementById('upscale-generate-btn');
                                    const resultContainer = document.getElementById('upscale-result-container');
                                    const resultText = document.getElementById('upscale-result-text');
                                    const usePromptBtn = document.getElementById('upscale-use-prompt-btn');
                                    let uploadedImageDataUrl = "";

                                    uploadInput.addEventListener('change', function(e) {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = function(evt) {
                                            uploadedImageDataUrl = evt.target.result;
                                            previewImg.src = uploadedImageDataUrl;
                                            previewImg.classList.remove('hidden');
                                            removeBtn.classList.remove('hidden');
                                            generateBtn.disabled = false;
                                        };
                                        reader.readAsDataURL(file);
                                    });

                                    removeBtn.addEventListener('click', function() {
                                        uploadedImageDataUrl = "";
                                        previewImg.src = "";
                                        previewImg.classList.add('hidden');
                                        removeBtn.classList.add('hidden');
                                        uploadInput.value = "";
                                        generateBtn.disabled = true;
                                        resultContainer.classList.add('hidden');
                                        resultText.textContent = "";
                                    });

                                   generateBtn.addEventListener('click', async function () {
                                        if (!uploadedImageDataUrl) return;
                                        generateBtn.disabled = true;
                                        resultContainer.classList.add('hidden');
                                        resultText.textContent = "";

                                        const loadingIndicator = document.getElementById('loading-indicator');
                                        const loadingText = document.getElementById('loading-text');
                                        loadingText.textContent = "Menganalisa gambar...";
                                        loadingIndicator.classList.remove('hidden');

                                        try {
                                            let base64 = uploadedImageDataUrl;
                                            if (base64.startsWith("data:")) {
                                            base64 = base64.substring(base64.indexOf(",") + 1);
                                            }

                                            // 🔄 Kirim base64 ke serverless API
                                            const res = await fetch("/api/generatePrompt", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json"
                                            },
                                            body: JSON.stringify({ imageBase64: base64 })
                                            });

                                            if (!res.ok) throw new Error('Gagal menghubungi server.');
                                            const data = await res.json();

                                            let prompt = (data.prompt || '').trim();
                                            if (!prompt) prompt = "Maaf, tidak dapat menganalisa gambar.";
                                            resultText.textContent = prompt;
                                            resultContainer.classList.remove('hidden');
                                            usePromptBtn.dataset.prompt = encodeURIComponent(prompt);

                                        } catch (err) {
                                            resultText.textContent = "Terjadi kesalahan: " + err.message;
                                            resultContainer.classList.remove('hidden');
                                        } finally {
                                            generateBtn.disabled = false;
                                            loadingIndicator.classList.add('hidden');
                                        }
                                        });

                                        usePromptBtn.addEventListener('click', function () {
                                        const prompt = decodeURIComponent(usePromptBtn.dataset.prompt || '');
                                        const promptInput = document.getElementById('prompt-input');
                                        if (promptInput) {
                                            promptInput.value = prompt;
                                            if (typeof showInfoModal === "function") {
                                            showInfoModal('Prompt Ditempel', 'Prompt dari hasil analisa gambar telah ditempel ke area utama.');
                                            }
                                        }
                                        });
                                    })();

                                // ... existing code ...
                                    
    // === VIDEO PROMPT BUILDER LOGIC ===
        //script 5

                                    (function() {
                                    // Helper: Build prompt template
                                    function buildVideoPrompt() {
                                        const main = document.getElementById('video-prompt-main').value.trim();
                                        const style = document.getElementById('video-style').value;
                                        const angle = document.getElementById('video-angle').value;
                                        const movement = document.getElementById('video-movement').value;
                                        let duration = document.getElementById('video-duration').value;
                                        if (duration === 'custom') {
                                            duration = document.getElementById('video-duration-custom').value.trim() || 'custom';
                                        }
                                        let resolution = document.getElementById('video-resolution').value;
                                        if (resolution === 'custom') {
                                            resolution = document.getElementById('video-resolution-custom').value.trim() || 'custom';
                                        }
                                        const platform = document.getElementById('video-platform').value;
                                        const language = document.getElementById('video-language').value;
                                        const extra = document.getElementById('video-extra').value.trim();

                                        let prompt = '';
                                        prompt += `SCENE: ${main || '[Isi ide utama/skenario]'}\n`;
                                        prompt += `VISUAL STYLE: ${style}\n`;
                                        prompt += `CAMERA ANGLE: ${angle}\n`;
                                        prompt += `CAMERA MOVEMENT: ${movement}\n`;
                                        prompt += `DURATION: ${duration}\n`;
                                        prompt += `RESOLUTION: ${resolution}\n`;
                                        prompt += `PLATFORM: ${platform}\n`;
                                        if (extra) prompt += `EXTRA DETAILS: ${extra}\n`;
                                        prompt += `LANGUAGE: ${language}\n`;
                                        prompt += `# Prompt ini dapat digunakan di semua platform video AI (Veo, Kling, Sora, Pika, Runway, dll)\n`;
                                        return prompt;
                                    }

                                    // Show/hide custom input
                                    document.getElementById('video-duration').addEventListener('change', function() {
                                        document.getElementById('video-duration-custom').classList.toggle('hidden', this.value !== 'custom');
                                    });
                                    document.getElementById('video-resolution').addEventListener('change', function() {
                                        document.getElementById('video-resolution-custom').classList.toggle('hidden', this.value !== 'custom');
                                    });

                                    // Dropdown logic for export
                                    const exportBtn = document.getElementById('export-dropdown-btn');
                                    const exportMenu = document.getElementById('export-dropdown-menu');
                                    exportBtn.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        exportMenu.classList.toggle('hidden');
                                    });
                                    document.addEventListener('click', function(e) {
                                        if (!exportMenu.classList.contains('hidden')) {
                                            exportMenu.classList.add('hidden');
                                        }
                                    });
                                    exportMenu.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                    });

                                    // Hide preview prompt by default
                                    const previewPromptContainer = document.getElementById('video-prompt-preview-container');
                                    previewPromptContainer.classList.add('hidden');

                                    // Live preview (only update content, not show)
                                    function updatePreview() {
                                        document.getElementById('video-prompt-preview').textContent = buildVideoPrompt();
                                    }
                                    [
                                        'video-prompt-main','video-style','video-angle','video-movement','video-duration','video-duration-custom',
                                        'video-resolution','video-resolution-custom','video-platform','video-language','video-extra'
                                    ].forEach(id => {
                                        document.getElementById(id).addEventListener('input', updatePreview);
                                        document.getElementById(id).addEventListener('change', updatePreview);
                                    });
                                    updatePreview();

                                    // Download as TXT
                                    document.getElementById('download-video-prompt-btn').addEventListener('click', function() {
                                        const prompt = buildVideoPrompt();
                                        const blob = new Blob([prompt], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = 'video-prompt.txt';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(url);
                                        exportMenu.classList.add('hidden');
                                    });

                                    // Export as PDF
                                    document.getElementById('export-video-prompt-pdf-btn').addEventListener('click', function() {
                                        const prompt = buildVideoPrompt();
                                        const { jsPDF } = window.jspdf;
                                        const doc = new jsPDF();
                                        doc.setFont('courier', 'normal');
                                        doc.setFontSize(12);
                                        const lines = doc.splitTextToSize(prompt, 180);
                                        doc.text(lines, 10, 20);
                                        doc.save('video-prompt.pdf');
                                        exportMenu.classList.add('hidden');
                                    });

                                    // Copy to clipboard
                                    document.getElementById('copy-video-prompt-btn').addEventListener('click', function() {
                                        const prompt = buildVideoPrompt();
                                        navigator.clipboard.writeText(prompt).then(() => {
                                            this.innerHTML = `<i class="ph-fill ph-check-circle"></i><span>Disalin!</span>`;
                                            setTimeout(() => {
                                                this.innerHTML = `<i class="ph-fill ph-copy"></i> Salin Prompt`;
                                            }, 2000);
                                        });
                                        exportMenu.classList.add('hidden');
                                    });

                                    // Generate Preview (simulasi)
                                    document.getElementById('generate-video-preview-btn').addEventListener('click', function() {
                                        const previewResult = document.getElementById('video-preview-result');
                                        const previewText = document.getElementById('video-preview-result-text');
                                        const prompt = buildVideoPrompt();
                                        // Tampilkan preview prompt container
                                        previewPromptContainer.classList.remove('hidden');
                                        document.getElementById('video-prompt-preview').textContent = prompt;
                                        // Simulasi: tampilkan prompt sebagai "preview", bisa diganti dengan API call jika ada
                                        previewText.textContent = "Preview Video akan dibuat berdasarkan prompt berikut:\n\n" + prompt;
                                        previewResult.classList.remove('hidden');
                                    });

                                    // Hide preview prompt and result on input change (user edit)
                                    [
                                        'video-prompt-main','video-style','video-angle','video-movement','video-duration','video-duration-custom',
                                        'video-resolution','video-resolution-custom','video-platform','video-language','video-extra'
                                    ].forEach(id => {
                                        document.getElementById(id).addEventListener('input', function() {
                                            previewPromptContainer.classList.add('hidden');
                                            document.getElementById('video-preview-result').classList.add('hidden');
                                        });
                                        document.getElementById(id).addEventListener('change', function() {
                                            previewPromptContainer.classList.add('hidden');
                                            document.getElementById('video-preview-result').classList.add('hidden');
                                        });
                                    });
                                })();
    //script 6

     
                    document.getElementById('info-editor-tools-btn').addEventListener('click', function() {
                        if (typeof showInfoModal === "function") {
                            showInfoModal(
                                "Editor Tools",
                                "Panel ini berisi alat-alat lanjutan untuk mengedit, meningkatkan, atau menambahkan efek pada gambar hasil AI Anda. Pilih salah satu alat untuk mulai menggunakan fitur seperti video prompt, audio tools, enhance, watermark, image to prompt, atau chat asisten."
                            );
                        }
                    });
                    
    //script 7

      
                        const tipsAccordionToggle = document.getElementById('tips-accordion-toggle');
                        const tipsAccordionContent = document.getElementById('tips-accordion-content');
                        const tipsAccordionArrow = document.getElementById('tips-accordion-arrow');
                        tipsAccordionToggle.addEventListener('click', () => {
                            const expanded = !tipsAccordionContent.classList.contains('hidden');
                            tipsAccordionContent.classList.toggle('hidden');
                            tipsAccordionArrow.classList.toggle('rotate-180', !expanded);
                        });
    //script 8

    
                            document.getElementById('reset-batch-btn').addEventListener('click', function() {
                                document.getElementById('batch-select').selectedIndex = 0;
                            });
    //script 9

        
                        document.getElementById('info-advanced-options-btn').addEventListener('click', function() {
                            if (typeof showInfoModal === "function") {
                                showInfoModal(
                                    "Advanced Options",
                                    "Panel ini berisi pengaturan lanjutan untuk memilih model AI, gaya seni, pencahayaan, ukuran gambar, dan jumlah batch gambar yang ingin dihasilkan. Pastikan Anda memilih opsi yang sesuai dengan kebutuhan sebelum menekan tombol Generate."
                                );
                            }
                        });
                        
    //script 10 

     
                        // Accordion toggle logic
                        const stockPromptToggle = document.getElementById('stock-prompt-toggle');
                        const stockPromptContent = document.getElementById('stock-prompt-content');
                        const stockPromptArrow = document.getElementById('stock-prompt-arrow');
                        stockPromptToggle.addEventListener('click', () => {
                            const expanded = !stockPromptContent.classList.contains('hidden');
                            stockPromptContent.classList.toggle('hidden');
                            stockPromptArrow.classList.toggle('rotate-180', !expanded);
                        });

                        // Use Prompt logic for stock prompts
                        stockPromptContent.addEventListener('click', function(e) {
                            const btn = e.target.closest('.btn-use-stock-prompt');
                            if (!btn) return;
                            const prompt = btn.dataset.prompt || '';
                            const promptInput = document.getElementById('prompt-input');
                            if (promptInput) {
                                promptInput.value = prompt;
                                if (typeof showInfoModal === "function") {
                                    showInfoModal('Prompt Ditempel', 'Prompt dari Stock Prompt telah ditempel ke area utama.');
                                }
                            }
                        });

    //script 11
    
    
                    document.getElementById('info-generate-btn').addEventListener('click', function() {
                        if (typeof showInfoModal === "function") {
                            showInfoModal(
                                "Panel Image Generator",
                                "Panel ini memungkinkan Anda untuk membuat gambar menggunakan AI dengan memasukkan prompt yang diinginkan. Anda dapat mengatur model AI, gaya seni, pencahayaan, ukuran, dan jumlah gambar yang ingin dihasilkan. Gunakan tombol Enhance untuk meningkatkan kualitas prompt Anda, Copy untuk menyalin prompt, Paste untuk menempelkan prompt dari clipboard, dan Clear untuk menghapus prompt yang ada.",
                            );
                        }
                    });
    //script 12 

    
        // Neumorphic 3D Mode Toggle
        const neumorphicToggle = document.getElementById('neumorphic-toggle');
        const neumorphicIcon = document.getElementById('neumorphic-icon');
        const neumorphicText = document.getElementById('neumorphic-text');
        neumorphicToggle.addEventListener('click', () => {
            const is3D = document.body.classList.toggle('neumorphic-3d');
            if (is3D) {
                // Remove dark mode if active
                document.body.classList.remove('dark-mode');
                neumorphicIcon.className = 'ph ph-cube text-xl text-indigo-500';
                neumorphicText.textContent = '3D Mode';
            } else {
                // Optionally restore dark mode if it was active before
                // document.body.classList.add('dark-mode');
                neumorphicIcon.className = 'ph ph-cube text-xl text-gray-500';
                neumorphicText.textContent = '3D Mode';
            }
        });

        // If you want to toggle dark mode together with 3D mode, uncomment below:
        // neumorphicToggle.addEventListener('contextmenu', (e) => {
        //     e.preventDefault();
        //     document.body.classList.toggle('dark-mode');
        // });

    //script 13 
     
        // --- Accent View Color logic (Realtime, iOS-style toggle) ---
        const accentToggle = document.getElementById('accent-toggle');
        const accentColorPicker = document.getElementById('accent-color-picker');
        const accentUndoBtn = document.getElementById('accent-undo-btn');
        let accentDefault = "#cc0044";
        let accentPrev = accentDefault;

        // iOS-style toggle
        function updateAccentToggleUI() {
            const toggle = accentToggle;
            const slider = toggle.parentElement.querySelector('div');
            if (toggle.checked) {
            slider.classList.add('bg-indigo-500');
            slider.classList.remove('bg-gray-200');
            slider.style.boxShadow = '0 0 0 2px #6366f1';
            slider.style.transition = 'background 0.3s';
            } else {
            slider.classList.remove('bg-indigo-500');
            slider.classList.add('bg-gray-200');
            slider.style.boxShadow = '';
            }
        }

        function setAccentColor(color) {
            document.documentElement.style.setProperty('--primary-color', color);
            accentPrev = color;
        }

        // Realtime update
        accentColorPicker.addEventListener('input', function() {
            if (accentToggle.checked) {
            setAccentColor(this.value);
            }
        });

        accentToggle.addEventListener('change', function() {
            updateAccentToggleUI();
            if (this.checked) {
            setAccentColor(accentColorPicker.value);
            } else {
            setAccentColor(accentDefault);
            }
        });

        // Initial UI sync
        updateAccentToggleUI();

        accentUndoBtn.addEventListener('click', function() {
            accentColorPicker.value = accentDefault;
            setAccentColor(accentDefault);
            accentToggle.checked = false;
            updateAccentToggleUI();
        });

        // --- Reset All Setting logic ---
        const resetToggle = document.getElementById('reset-toggle');
        const resetConfirmModal = document.getElementById('reset-confirm-modal');
        const resetYes = document.getElementById('reset-confirm-yes');
        const resetNo = document.getElementById('reset-confirm-no');
        function updateResetToggleUI() {
            const toggle = resetToggle;
            const slider = toggle.parentElement.querySelector('div');
            if (toggle.checked) {
            slider.classList.add('bg-red-500');
            slider.classList.remove('bg-gray-200');
            slider.style.boxShadow = '0 0 0 2px #ef4444';
            slider.style.transition = 'background 0.3s';
            } else {
            slider.classList.remove('bg-red-500');
            slider.classList.add('bg-gray-200');
            slider.style.boxShadow = '';
            }
        }
        resetToggle.addEventListener('change', function() {
            updateResetToggleUI();
            if (this.checked) {
            resetConfirmModal.classList.remove('hidden');
            }
        });
        resetYes.addEventListener('click', function() {
            // Reset all settings to default
            accentColorPicker.value = accentDefault;
            setAccentColor(accentDefault);
            accentToggle.checked = false;
            updateAccentToggleUI();
            document.getElementById('api-key-input').value = '';
            resetToggle.checked = false;
            updateResetToggleUI();
            resetConfirmModal.classList.add('hidden');

            // Reset prompt input
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) promptInput.value = '';

            // Reset selects to first option
            ['model-select', 'art-style-select', 'style-select', 'size-select', 'batch-select'].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) sel.selectedIndex = 0;
            });

            // Reset generated images and history
            if (window.generatedImagesData) window.generatedImagesData = [];
            const imageGrid = document.getElementById('image-grid');
            if (imageGrid) {
            imageGrid.className = 'w-full h-full flex items-center justify-center';
            imageGrid.innerHTML = `
                <div class="text-center text-gray-500">
                <i class="ph-fill ph-image-square text-6xl"></i>
                <p class="mt-4 font-medium">Gambar Anda akan muncul di sini</p>
                </div>
            `;
            }
            const historyContainer = document.getElementById('history-container');
            const historyPlaceholder = document.getElementById('history-placeholder');
            if (historyContainer && historyPlaceholder) {
            historyContainer.innerHTML = '';
            historyPlaceholder.classList.remove('hidden');
            historyContainer.appendChild(historyPlaceholder);
            }

            // Reset enhance tool panel
            const enhanceThumbnails = document.getElementById('enhance-thumbnails');
            const enhanceOptionsContainer = document.getElementById('enhance-options-container');
            const enhanceResultContainer = document.getElementById('enhance-result-container');
            if (enhanceThumbnails) enhanceThumbnails.innerHTML = '';
            if (enhanceOptionsContainer) enhanceOptionsContainer.classList.add('hidden');
            if (enhanceResultContainer) enhanceResultContainer.classList.add('hidden');

            // Reset watermark tool panel
            const watermarkThumbnails = document.getElementById('watermark-thumbnails');
            const watermarkOptionsContainer = document.getElementById('watermark-options-container');
            const watermarkPreviewContainer = document.getElementById('watermark-preview-container');
            if (watermarkThumbnails) watermarkThumbnails.innerHTML = '';
            if (watermarkOptionsContainer) watermarkOptionsContainer.classList.add('hidden');
            if (watermarkPreviewContainer) watermarkPreviewContainer.classList.add('hidden');

            // Reset audio tool panel
            const audioCharacter = document.getElementById('audio-character');
            const audioNarration = document.getElementById('audio-narration');
            const audioResultContainer = document.getElementById('audio-result-container');
            if (audioCharacter) audioCharacter.value = '';
            if (audioNarration) audioNarration.value = '';
            if (audioResultContainer) {
            audioResultContainer.classList.add('hidden');
            audioResultContainer.innerHTML = '';
            }

            // Reset video tool panel
            const videoPromptMain = document.getElementById('video-prompt-main');
            if (videoPromptMain) videoPromptMain.value = '';

            // Reset chat assistant
            if (window.setChatHistory) {
            window.setChatHistory([
                {
                role: "system",
                content: "Kamu adalah asisten AI yang hanya membantu membuat prompt untuk image generation model flux, turbo, dan gptimage. Jawab hanya seputar pembuatan prompt, jangan menjawab hal lain."
                }
            ]);
            }

            
            // Reset theme toggle UI
            const themeIcon = document.getElementById('theme-icon');
            const themeText = document.getElementById('theme-text');
            if (themeIcon && themeText) {
            themeIcon.className = 'ph ph-sun text-xl text-amber-500';
            themeText.textContent = 'Light Mode';
            }
            // Reset neumorphic toggle UI
            const neumorphicIcon = document.getElementById('neumorphic-icon');
            const neumorphicText = document.getElementById('neumorphic-text');
            if (neumorphicIcon && neumorphicText) {
            neumorphicIcon.className = 'ph ph-cube text-xl text-gray-500';
            neumorphicText.textContent = '3D Mode';
            }
        });
        resetNo.addEventListener('click', function() {
            resetToggle.checked = false;
            updateResetToggleUI();
            resetConfirmModal.classList.add('hidden');
        });


        // On load, sync accent color if toggle is on
        if (accentToggle.checked) {
            setAccentColor(accentColorPicker.value);
        } else {
            setAccentColor(accentDefault);
        }
        updateAccentToggleUI();
        updateResetToggleUI();
    
//script 14 


        // Setting Modal Logic
        const navSettingBtn = document.getElementById('nav-setting');
        const settingModal = document.getElementById('setting-modal');
        const closeSettingModal = document.getElementById('close-setting-modal');
        navSettingBtn.addEventListener('click', () => {
            settingModal.classList.remove('hidden');
        });
        closeSettingModal.addEventListener('click', () => {
            settingModal.classList.add('hidden');
        });
        settingModal.addEventListener('click', (e) => {
            if (e.target === settingModal) {
                settingModal.classList.add('hidden');
            }
        });
    
           
            

//script 15




 
    
    









