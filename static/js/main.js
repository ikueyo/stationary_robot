// static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 獲取所有需要的 HTML 元素
    const canvas = document.getElementById('canvas');
    const askAiBtn = document.getElementById('ask-ai-btn');
    const resetBtn = document.getElementById('reset-btn');
    const aiSentenceEl = document.getElementById('ai-sentence');
    const speakBtn = document.getElementById('speak-btn');
    const loadingEl = document.getElementById('loading');
    
    const appContainer = document.querySelector('.app-container');
    const DESIGN_WIDTH = 1400;
    const DESIGN_HEIGHT = 900;

    // --- 響應式縮放邏輯 ---
    function updateScaling() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const scaleX = windowWidth / DESIGN_WIDTH;
        const scaleY = windowHeight / DESIGN_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (windowWidth - (DESIGN_WIDTH * scale)) / 2;
        const offsetY = (windowHeight - (DESIGN_HEIGHT * scale)) / 2;
        appContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }

    window.addEventListener('resize', updateScaling);
    updateScaling();

    // --- 變數與狀態管理 ---
    let stationeryCounts = {
        pencil: 0, eraser: 0, ruler: 0,
        pen: 0, book: 0, marker: 0
    };
    let lastAudioSequence = [];

    const itemColors = {
        pencil: '#D9A404', eraser: '#D90467', ruler:  '#04A6D9',
        pen:    '#D9042B', book:   '#04D94F', marker: '#8D04D9'
    };

    // --- 全新：循序播放語音引擎 ---
    let audioContext;
    let gainNode;
    let activeSources = [];
    let isPlaying = false; // 新增狀態旗標

    function initAudio() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                gainNode = audioContext.createGain();
                gainNode.gain.value = 0.9; 
                gainNode.connect(audioContext.destination);
            } catch (e) {
                console.error("Web Audio API is not supported in this browser");
                alert("您的瀏覽器不支援音訊播放功能。");
            }
        }
    }

    function stopAllAudio() {
        isPlaying = false; // 透過旗標中斷循序播放
        activeSources.forEach(source => {
            try {
                source.onended = null; // 移除事件監聽，防止中斷後還觸發下一個播放
                source.stop();
            } catch (e) {}
        });
        activeSources = [];
    }

    /**
     * [重構] 根據檔名序列，循序播放拼接的音訊
     * @param {string[]} files - 不含副檔名的音檔名稱陣列
     */
    async function playAudioSequence(files) {
        if (isPlaying) return; // 如果正在播放，則不執行新的播放請求
        if (!audioContext) {
            console.error("AudioContext not initialized.");
            return;
        }
        
        stopAllAudio();
        isPlaying = true;

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // 步驟 1: 預先載入所有音訊緩衝
        const audioBuffers = await Promise.all(
            files.map(async (file) => {
                const path = `static/audio/${file}.mp3`;
                try {
                    const response = await fetch(path);
                    const arrayBuffer = await response.arrayBuffer();
                    return await audioContext.decodeAudioData(arrayBuffer);
                } catch (error) {
                    console.error(`載入或解碼音檔失敗: ${path}`, error);
                    return null;
                }
            })
        );

        // 步驟 2: 定義循序播放器
        function playNext(index) {
            // 終止條件: 序列播放完畢，或被外部中斷
            if (!isPlaying || index >= audioBuffers.length) {
                isPlaying = false;
                return;
            }

            const buffer = audioBuffers[index];
            if (buffer) {
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(gainNode);
                
                // 核心：當這個音檔播放結束時，才去播放下一個
                source.onended = () => playNext(index + 1);
                
                source.start();
                activeSources.push(source);
            } else {
                // 如果某個音檔載入失敗，直接跳到下一個
                playNext(index + 1);
            }
        }

        // 步驟 3: 啟動播放序列
        playNext(0);
    }

    // --- 句子與音訊序列生成 ---
    function numberToWord(num) {
        const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
        return (num > 0 && num < words.length) ? words[num] : num.toString();
    }

    function createSentenceAndAudioPlan(counts) {
        const usedItemsForText = [];
        const audioChunks = [];
        const usedItemNamesForColor = [];

        // 步驟 1: 收集所有使用到的文具資訊，並建立對應的文字和語音片段
        for (const name in counts) {
            const count = counts[name];
            if (count > 0) {
                if (count === 1) {
                    usedItemsForText.push(`a ${name}`);
                    audioChunks.push(['a', name]);
                } else {
                    usedItemsForText.push(`${count} ${name}s`);
                    audioChunks.push([numberToWord(count), `${name}s`]);
                }
                usedItemNamesForColor.push(name);
            }
        }

        if (usedItemsForText.length === 0) return null;

        // 步驟 2: 產生用於顯示的句子字串
        let itemsStr;
        if (usedItemsForText.length === 1) {
            itemsStr = usedItemsForText[0];
        } else if (usedItemsForText.length === 2) {
            itemsStr = usedItemsForText.join(' and ');
        } else {
            itemsStr = usedItemsForText.slice(0, -1).join(', ') + ', and ' + usedItemsForText[usedItemsForText.length - 1];
        }
        const displayText = `I use ${itemsStr} to make a robot.`;

        // 步驟 3: 產生最終的語音檔序列 (更簡潔、穩健的邏輯)
        const finalAudioSequence = ['I use'];
        const numChunks = audioChunks.length;

        audioChunks.forEach((chunk, index) => {
            // 如果文具總數超過一個，且這是最後一個文具，那麼在它前面加上 'and'
            if (numChunks > 1 && index === numChunks - 1) {
                finalAudioSequence.push('and');
            }
            // 將目前文具的語音片段加入序列
            finalAudioSequence.push(...chunk);
        });

        finalAudioSequence.push('to make a robot');

        return {
            sentence: displayText,
            audioFiles: finalAudioSequence,
            items: usedItemNamesForColor
        };
    }

    function colorizeSentence(sentence, items) {
        let colorizedSentence = sentence;
        const allItemsToColor = new Set(items.flatMap(item => [item, item + 's']));
        allItemsToColor.forEach(item => {
            const baseItem = item.endsWith('s') ? item.slice(0, -1) : item;
            const color = itemColors[baseItem];
            if (color) {
                const regex = new RegExp(`\b(${item})\b`, 'gi');
                colorizedSentence = colorizedSentence.replace(regex, `<span style="color: ${color}; font-weight: bold;">${item}</span>`);
            }
        });
        return colorizedSentence;
    }

    // --- Interact.js 拖放與手勢邏輯 ---
    interact('.stationery-item').draggable({
        inertia: true,
        listeners: {
            start(event) {
                document.querySelector('.placeholder-text')?.remove();
                const originalImg = event.target.querySelector('img');
                if (!originalImg) return;
                const clone = document.createElement('img');
                clone.src = originalImg.src;
                clone.classList.add('dragging-clone');
                document.body.appendChild(clone);
                clone.style.left = `${event.client.x - 50}px`;
                clone.style.top = `${event.client.y - 50}px`;
                event.interaction.clone = clone;
            },
            move(event) {
                if (event.interaction.clone) {
                    event.interaction.clone.style.left = `${event.client.x - 50}px`;
                    event.interaction.clone.style.top = `${event.client.y - 50}px`;
                }
            },
            end(event) {
                event.interaction.clone?.remove();
            }
        }
    });

    interact('#canvas').dropzone({
        accept: '.stationery-item',
        ondrop: function (event) {
            const originalItem = event.relatedTarget;
            const itemName = originalItem.dataset.name;
            stationeryCounts[itemName]++;
            const newItem = document.createElement('img');
            newItem.src = originalItem.querySelector('img').src;
            newItem.alt = itemName;
            newItem.className = 'dropped-item';
            const canvasRect = canvas.getBoundingClientRect();
            const scale = parseFloat(appContainer.style.transform.split('scale(')[1]) || 1;
            const initialX = (event.dragEvent.client.x - canvasRect.left) / scale - 60;
            const initialY = (event.dragEvent.client.y - canvasRect.top) / scale - 60;
            newItem.style.transform = `translate(${initialX}px, ${initialY}px)`;
            newItem.setAttribute('data-x', initialX);
            newItem.setAttribute('data-y', initialY);
            canvas.appendChild(newItem);
            setupGestures(newItem);
        }
    });

    const setupGestures = (target) => {
        interact(target).draggable({
            listeners: {
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                    const angle = parseFloat(target.getAttribute('data-angle')) || 0;
                    const scale = parseFloat(target.getAttribute('data-scale')) || 1;
                    target.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                }
            },
            modifiers: [interact.modifiers.restrictRect({ restriction: 'parent' })]
        }).gesturable({
            listeners: {
                move(event) {
                    const target = event.target;
                    let angle = parseFloat(target.getAttribute('data-angle')) || 0;
                    let scale = parseFloat(target.getAttribute('data-scale')) || 1;
                    angle += event.da;
                    scale *= (1 + event.ds);
                    const x = parseFloat(target.getAttribute('data-x')) || 0;
                    const y = parseFloat(target.getAttribute('data-y')) || 0;
                    target.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`;
                    target.setAttribute('data-angle', angle);
                    target.setAttribute('data-scale', scale);
                }
            }
        });
    };

    // --- 控制面板按鈕事件 ---
    askAiBtn.addEventListener('click', () => {
        initAudio();
        loadingEl.style.display = 'block';
        aiSentenceEl.innerHTML = '...';
        speakBtn.style.display = 'none';
        lastAudioSequence = [];

        setTimeout(() => {
            const plan = createSentenceAndAudioPlan(stationeryCounts);
            if (!plan) {
                aiSentenceEl.textContent = '請先將文具拖曳到畫板上！';
                loadingEl.style.display = 'none';
                return;
            }
            const colorizedHtml = colorizeSentence(plan.sentence, plan.items);
            aiSentenceEl.innerHTML = colorizedHtml;
            speakBtn.style.display = 'block';
            loadingEl.style.display = 'none';
            lastAudioSequence = plan.audioFiles;
            playAudioSequence(lastAudioSequence);
        }, 500);
    });

    speakBtn.addEventListener('click', () => {
        initAudio();
        if (lastAudioSequence.length > 0) {
            playAudioSequence(lastAudioSequence);
        }
    });

    resetBtn.addEventListener('click', () => {
        stopAllAudio();
        canvas.innerHTML = '<div class="placeholder-text">請從左邊拖曳文具到這裡，創造你的機器人！</div>';
        for (const key in stationeryCounts) {
            stationeryCounts[key] = 0;
        }
        aiSentenceEl.textContent = '...';
        speakBtn.style.display = 'none';
        lastAudioSequence = [];
    });
});