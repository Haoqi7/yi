class App {
    static #currentMode = 'auto';
    static #debounceTimer;

    static #sanitize(text) {
        return text.replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/&/g, '&amp;');
    }

    static init() {
        BearTranslator.init();
        
        // 输入框变化时转换（带防抖）
        document.getElementById('input').addEventListener('input', () => 
            this.#convertWithDebounce(300));
        
        // 模式切换按钮
        document.querySelectorAll('.mode-switch button').forEach(btn => {
            btn.addEventListener('click', () => 
                this.#setMode(btn.dataset.mode));
        });

        // 字典选择框变化时实时更新
        document.getElementById('useDictionary').addEventListener('change', () => {
            this.#convertWithDebounce(0);
        });
    }

    static #setMode(mode) {
        this.#currentMode = mode;
        document.querySelectorAll('.mode-switch button')
            .forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`)
            .classList.add('active');
        this.#convertWithDebounce(0);
    }

    static #convertWithDebounce = ((delay) => {
        clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(() => {
            const input = document.getElementById('input').value;
            // 获取字典选择状态
            const useDict = document.getElementById('useDictionary').checked;
            // 传递useDict参数
            const result = BearTranslator.convert(input, this.#currentMode, useDict);
            this.#updateUI(result);
        }, delay);
    }).bind(App);

    static #updateUI(result) {
        const resultDiv = document.getElementById('conversion-result');
        const tagsDiv = document.getElementById('code-tags');
        
        resultDiv.innerHTML = this.#sanitize(result.displayText);
        
        // 显示每个部分的转换类型（字典/编码）
        tagsDiv.innerHTML = result.details.map(part => {
            let tagClass = '';
            let tagText = '';
            switch(part.type) {
                case 'dict': 
                    tagClass = 'dict-tag';
                    tagText = '词典';
                    break;
                case 'encode':
                    tagClass = 'encode-tag';
                    tagText = '编码';
                    break;
                case 'decode':
                    tagClass = 'decode-tag';
                    tagText = '解码';
                    break;
                default:
                    tagClass = '';
                    tagText = '直译';
            }
            return `<span class="output-tag ${tagClass}">${this.#sanitize(tagText)}</span>`;
        }).join(' ');
    }

    static copyResult() {
        const text = document.getElementById('conversion-result').textContent;
        navigator.clipboard.writeText(text).then(() => {
            const status = document.getElementById('status');
            status.textContent = '✅ 已复制到剪贴板！';
            setTimeout(() => status.textContent = '✅ 系统运行中', 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            document.getElementById('status').textContent = '⚠️ 复制失败，请手动选择复制';
        });
    }
}

// 初始化应用
App.init();
