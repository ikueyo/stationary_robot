// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.querySelector('.app-container');
    const DESIGN_WIDTH = 1400;
    const DESIGN_HEIGHT = 900;

    function updateScaling() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const scaleX = windowWidth / DESIGN_WIDTH;
        const scaleY = windowHeight / DESIGN_HEIGHT;

        // 選擇較小的縮放比例，以確保整個應用都能顯示在視窗內
        const scale = Math.min(scaleX, scaleY);

        // 計算置中需要的偏移量
        const offsetX = (windowWidth - (DESIGN_WIDTH * scale)) / 2;
        const offsetY = (windowHeight - (DESIGN_HEIGHT * scale)) / 2;

        // 應用縮放和位移
        appContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }

    // 頁面載入時和視窗大小改變時都執行縮放更新
    window.addEventListener('resize', updateScaling);
    updateScaling(); // 初始載入時執行一次
    
    // 獲取所有需要的 HTML 元素
    const canvas = document.getElementById('canvas');
    const askAiBtn = document.getElementById('ask-ai-btn');
    const resetBtn = document.getElementById('reset-btn');
    const aiSentenceEl = document.getElementById('ai-sentence');
    const speakBtn = document.getElementById('speak-btn');
    const loadingEl = document.getElementById('loading');
    
    // 修正：與 index.html 的文具項目同步
    let stationeryCounts = {
        pencil: 0, eraser: 0, ruler: 0,
        pen: 0, book: 0, marker: 0
    };

    // 為不同文具定義顏色
    const itemColors = {
        pencil: '#D9A404', // 金色
        eraser: '#D90467', // 桃紅色
        ruler:  '#04A6D9', // 天藍色
        pen:    '#D9042B', // 緋紅色
        book:   '#04D94F', // 萊姆綠
        marker: '#8D04D9'  // 紫羅蘭色
    };

    /**
     * 為句子中的文具單字上色
     * @param {string} sentence - AI 生成的原始句子
     * @param {string[]} items - 包含在句子中的文具名稱列表
     * @returns {string} - 包含 HTML <span> 標籤的彩色句子
     */
    function colorizeSentence(sentence, items) {
        let colorizedSentence = sentence;
        
        // 建立一個包含單數和複數的搜尋列表
        const allItemsToColor = new Set();
        items.forEach(item => {
            allItemsToColor.add(item);
            // 簡單地加上 's' 來處理複數 (例如: pencil -> pencils)
            if (!item.endsWith('s')) {
                 allItemsToColor.add(item + 's');
            }
        });

        allItemsToColor.forEach(item => {
            // 找出單字對應的顏色 (例如 "pencils" 對應 "pencil" 的顏色)
            const baseItem = item.endsWith('s') ? item.slice(0, -1) : item;
            const color = itemColors[baseItem];
            
            if (color) {
                // 使用正規表示式來取代所有符合的單字 (忽略大小寫)
                // \b 確保我們只匹配完整的單字 (例如 "pen" 不會匹配到 "pencil" 的一部分)
                const regex = new RegExp(`\\b(${item})\\b`, 'gi');
                colorizedSentence = colorizedSentence.replace(regex, 
                    `<span style="color: ${color};">${item}</span>`
                );
            }
        });
        return colorizedSentence;
    }

    // --- Interact.js Gesture Setup for Canvas Items ---

    const setupGestures = (target) => {
        // Keep track of angle and scale
        let angle = 0;
        let scale = 1;

        interact(target)
            .draggable({
                listeners: { move: dragMoveListener },
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent'
                    })
                ]
            })
            .gesturable({
                listeners: {
                    move(event) {
                        const target = event.target;
                        
                        // Update angle and scale based on gesture
                        angle += event.da;
                        scale *= (1 + event.ds);

                        // Apply transform
                        const x = parseFloat(target.getAttribute('data-x')) || 0;
                        const y = parseFloat(target.getAttribute('data-y')) || 0;
                        
                        target.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;
                        
                        // Store values for next event
                        target.setAttribute('data-angle', angle);
                        target.setAttribute('data-scale', scale);
                    }
                }
            });
    };
    
    function dragMoveListener(event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        // Get current rotation and scale if they exist
        const angle = parseFloat(target.getAttribute('data-angle')) || 0;
        const scale = parseFloat(target.getAttribute('data-scale')) || 1;

        // Apply all transforms
        target.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    // --- Sidebar Drag and Drop Logic ---

    interact('.stationery-item').draggable({
        inertia: true,
        listeners: {
            start(event) {
                const placeholderText = document.querySelector('.placeholder-text');
                if (placeholderText) placeholderText.style.display = 'none';
                
                // *** FIX: Create a clone of the IMAGE for dragging ***
                const original = event.target;
                const originalImg = original.querySelector('img');
                
                if (!originalImg) return;

                const clone = document.createElement('img');
                clone.src = originalImg.src;
                clone.classList.add('dragging-clone');
                document.body.appendChild(clone);

                // Position the clone initially
                clone.style.left = `${event.client.x - 40}px`;
                clone.style.top = `${event.client.y - 40}px`;

                // Store the clone on the interaction object
                event.interaction.clone = clone;
            },
            move(event) {
                // Move the clone, not the original
                const clone = event.interaction.clone;
                if (clone) {
                    const x = (parseFloat(clone.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(clone.getAttribute('data-y')) || 0) + event.dy;

                    clone.style.position = 'absolute';
                    clone.style.left = `${event.client.x - 50}px`; // 40 is half width
                    clone.style.top = `${event.client.y - 50}px`; // 40 is half height
                }
            },
            end(event) {
                // Remove the clone
                if (event.interaction.clone) {
                    event.interaction.clone.remove();
                }
            }
        }
    });

    interact('#canvas').dropzone({
        accept: '.stationery-item',
        ondrop: function (event) {
            const originalItem = event.relatedTarget;
            const itemName = originalItem.dataset.name;
            const itemImgSrc = originalItem.querySelector('img').src;

            stationeryCounts[itemName]++;

            const newItem = document.createElement('img');
            newItem.src = itemImgSrc;
            newItem.alt = itemName;
            newItem.className = 'dropped-item';
            
            const canvasRect = canvas.getBoundingClientRect();
            const initialX = event.dragEvent.client.x - canvasRect.left - 50;
            const initialY = event.dragEvent.client.y - canvasRect.top - 50;

            newItem.style.transform = `translate(${initialX}px, ${initialY}px)`;
            newItem.setAttribute('data-x', initialX);
            newItem.setAttribute('data-y', initialY);
            
            canvas.appendChild(newItem);
            setupGestures(newItem);
        }
    });

    // --- AI Panel, Speak, and Reset Logic ---

    // 儲存可用的語音
    let voices = [];
    
    // 獲取並儲存瀏覽器提供的語音
    function populateVoiceList() {
        voices = speechSynthesis.getVoices();
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    /**
     * 使用更高品質的語音來朗讀文字
     * @param {string} text - 要朗讀的文字
     */
    function speakText(text) {
        if (!text || text === '...') return;

        // 停止任何正在播放的語音
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // 尋找更高品質的英文語音
        let bestVoice = voices.find(voice => 
            voice.lang === 'en-US' && voice.name.includes('Google')
        ) || voices.find(voice => 
            voice.lang === 'en-US' && voice.name.includes('Microsoft')
        ) || voices.find(voice => 
            voice.lang === 'en-US'
        );

        if (bestVoice) {
            utterance.voice = bestVoice;
        }
        
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }

    /**
     * (NEW) Directly creates a sentence in JavaScript based on stationery counts.
     * This replaces the backend Python function.
     * @param {object} counts - An object with stationery names as keys and their counts as values.
     * @returns {{sentence: string, items: string[]}|null} - An object with the generated sentence and a list of used items, or null if no items were used.
     */
    function createSentenceDirectly(counts) {
        const usedItems = [];
        const usedItemNames = [];

        for (const name in counts) {
            const count = counts[name];
            if (count > 0) {
                // Handle pluralization: add 's' if count is greater than 1.
                const itemStr = count === 1 ? `${count} ${name}` : `${count} ${name}s`;
                usedItems.push(itemStr);
                usedItemNames.push(name);
            }
        }

        if (usedItems.length === 0) {
            return null; // No items to create a sentence with.
        }

        let itemsStr;
        if (usedItems.length === 1) {
            itemsStr = usedItems[0];
        } else if (usedItems.length === 2) {
            itemsStr = usedItems.join(' and ');
        } else {
            itemsStr = usedItems.slice(0, -1).join(', ') + ', and ' + usedItems[usedItems.length - 1];
        }

        const finalSentence = `I use ${itemsStr} to make a robot.`;
        
        return {
            sentence: finalSentence,
            items: usedItemNames
        };
    }

    askAiBtn.addEventListener('click', () => {
        loadingEl.style.display = 'block';
        aiSentenceEl.innerHTML = '...';
        speakBtn.style.display = 'none';

        // Simulate a short delay to give feedback to the user
        setTimeout(() => {
            const result = createSentenceDirectly(stationeryCounts);

            if (!result) {
                aiSentenceEl.textContent = '請先將文具拖曳到畫板上！';
                loadingEl.style.display = 'none';
                return;
            }

            const colorizedHtml = colorizeSentence(result.sentence, result.items);
            aiSentenceEl.innerHTML = colorizedHtml;
            speakBtn.style.display = 'block';
            loadingEl.style.display = 'none';
        }, 500); // 500ms delay
    });

    speakBtn.addEventListener('click', () => {
        const textToSpeak = aiSentenceEl.textContent;
        speakText(textToSpeak);
    });

    resetBtn.addEventListener('click', () => {
        canvas.innerHTML = '<div class="placeholder-text">請從左邊拖曳文具到這裡，創造你的機器人！</div>';
        for (const key in stationeryCounts) {
            stationeryCounts[key] = 0;
        }
        aiSentenceEl.textContent = '...';
        speakBtn.style.display = 'none';
        speechSynthesis.cancel(); // 如果正在說話，就停止
    });
});
