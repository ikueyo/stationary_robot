from flask import Flask, render_template, request, jsonify

# 初始化 Flask 應用程式
app = Flask(__name__)

# 設定主路由，用於顯示我們的網頁 (index.html)
@app.route('/')
def index():
    return render_template('index.html')

# 處理來自前端的請求，直接生成句子
@app.route('/generate-sentence', methods=['POST'])
def generate_sentence():
    data = request.json
    stationery_counts = data.get('counts', {})

    # 直接生成句子，不再呼叫 AI
    sentence = create_sentence_directly(stationery_counts)
    
    if not sentence:
        return jsonify({"error": "沒有選擇任何文具"}), 400

    # 找出所有使用到的文具名稱
    used_item_names = [name for name, count in stationery_counts.items() if count is not None and count > 0]

    # 將生成的句子和使用到的文具列表一起回傳給前端
    return jsonify({
        "sentence": sentence,
        "items": used_item_names
    })

def create_sentence_directly(counts):
    """根據文具數量，直接生成符合句型的英文句子"""
    
    # 過濾掉數量為 0 的文具，並處理單複數
    used_items = []
    for name, count in counts.items():
        if count is not None and count > 0:
            # 處理複數：如果數量大於 1，在字尾加上 's'
            # 注意：這是一個簡化的規則，對於 'eraser' -> 'erasers' 是有效的
            item_str = f"{count} {name}" if count == 1 else f"{count} {name}s"
            used_items.append(item_str)
    
    if not used_items:
        return None

    # 將文具列表轉換成更自然的字串 (例如: "A, B and C")
    if len(used_items) == 1:
        items_str = used_items[0]
    elif len(used_items) == 2:
        items_str = " and ".join(used_items)
    else:
        # 用逗號連接，最後一個用 "and"
        items_str = ", ".join(used_items[:-1]) + ", and " + used_items[-1]
    
    # 套入固定的句型
    return f"I use {items_str} to make a robot."

# 讓 Flask 應用程式可以被執行
if __name__ == '__main__':
    # 監聽所有網路介面
    app.run(host='0.0.0.0', port=5000, debug=True)