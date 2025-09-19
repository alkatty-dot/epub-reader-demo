(function() {
    var isRendering = false; // Added: Track rendering state
    function isFixedLayout(book) {
        return book.package.metadata.layout === 'pre-paginated';
    }
    
    function setupTool() {
        var viewerDiv = document.getElementById("viewer");
        var viewerRect = viewerDiv.getBoundingClientRect();
        
        var toolButton = document.getElementById("toolButton");
        toolButton.style.top = viewerRect.top + "px";   
        toolButton.style.left = (viewerRect.left + viewerRect.width  - toolButton.getBoundingClientRect().width) +"px" ;
        toolButton.style.height = 100 + "px";
        
        var viewerEvent = document.getElementById("viewer_event");
        viewerEvent.style.top = viewerRect.top + "px";   
        viewerEvent.style.left = viewerRect.left + "px"; 
        
        var toolDiv = document.getElementById("toolDiv");
        toolDiv.style.top = viewerRect.top + "px";
        toolDiv.style.left = viewerRect.left + "px";
        toolDiv.style.height = (viewerRect.height-30) + "px";
        toolDiv.style.width = (viewerRect.width *0.8) + "px";
        
        viewerEvent.style.height = viewerRect.height + "px";
        viewerEvent.style.width = viewerRect.width + "px";
    }

    var book;
    var rendition;
    var cfiString;
    var pageProgressionDirection;

    function changeLayout() {
        book.destroy();
        start("viewer", "book2/item/standard.opf");
    }

    function start(containerId, bookUrl) {
        var layout = document.querySelector('input[name="layout"]:checked').value;
        
        book = ePub(bookUrl);
        book.ready.then(function () { 
            const packageDocument = book.package;
            pageProgressionDirection = packageDocument.metadata['direction'];

            if (pageProgressionDirection === 'ltr') {
                console.log("這是左至右的翻頁方向");
            } else if (pageProgressionDirection === 'rtl') {
                console.log("這是右至左的翻頁方向");
            } else {
                console.log("沒有明確設定翻頁方向");
            }
            
            const fixedLayout = isFixedLayout(book);
            console.log(fixedLayout);   
            rendition = book.renderTo(containerId, { 
                spread: layout,
                width: "100%",
                height: "100%",
            });
            
            if (fixedLayout) {
                document.getElementById("tool_theme_div").style.display = 'none';
                document.getElementById("tool_lineHeigh_div").style.display = 'none';
                document.getElementById("tool_letterSpacing_div").style.display = 'none';
                document.getElementById("tool_fontSize_div").style.display = 'none';
            }
            
            rendition.themes.register('dark', { "body": { "color": "white", 'background-color': 'black' } });
            rendition.themes.register('light', { "body": { "color": "black", 'background-color': 'white' } });
            rendition.themes.register('mi', { "body": { "color": "black", 'background-color': 'Beige' } });
            changeFontSize();
            changeTheme();
            changeLetterSpacing();
            changeLineHeight();
            setupTool();
            
            if(cfiString) {
                rendition.display(cfiString).then(() => { // Added: Handle display promise
                    isRendering = false;
                });
            } else {
                rendition.display().then(() => { // Added: Handle display promise
                    isRendering = false;
                });
            }
        });
    }


    function changeFontSize() {
        var selectedFontSize = document.getElementById("fontSize").value;
        rendition.themes.fontSize(selectedFontSize);
    }
    
    function changeTheme() {
        var theme = document.querySelector('input[name="theme"]:checked').value;
        var toolButton = document.getElementById("toolButton");
        
        if (toolButton) {
            if (theme === 'dark') {
                toolButton.style.color = "white";
            } else {
                toolButton.style.color = "black";
            }
        }

        rendition.themes.select(theme);
    }

    function changeLetterSpacing() {
        var selectedLetterSpacing = document.getElementById("letterSpacing").value;
        rendition.themes.default({
            "body": {
                "letter-spacing": selectedLetterSpacing,
            }
        });
        rendition.themes.update('default');
    }

    function changeLineHeight() {
        var selectedLineHeight = document.getElementById("lineHeight").value;
        rendition.themes.default({
            "*": {
                "line-height": selectedLineHeight,
            }
        });
        rendition.themes.update('default');
    }

    function goToPreviousPage() {
        if (isRendering){
			 return;
		} // Added: Check rendering state
        isRendering = true;
        rendition.prev().then(() => {
            cfiString = rendition.currentLocation().start.cfi;
            isRendering = false;
        }).catch(() => {
            isRendering = false;
        });
    }

    function goToNextPage() {
        if (isRendering){
			 return;
		} // Added: Check rendering state
        isRendering = true;
        rendition.next().then(() => {
            cfiString = rendition.currentLocation().start.cfi;
            isRendering = false;
        }).catch(() => {
            isRendering = false;
        });
    }

    var isLoadToc = false;

    function showToc() {
        const toolDiv = document.getElementById("toolDiv");
        if (toolDiv && toolDiv.style.display !== "none") {
            closeTool();
        }
        
        var tocDiv = document.getElementById("toc");
        if (tocDiv && tocDiv.style.display !== "none") {
            closeToc();
            return;
        }
        tocDiv.style.display = "block";
        if(false == isLoadToc) {
            loadToc();
        }
    }

    function closeToc() {
        var tocDiv = document.getElementById("toc");
        tocDiv.style.display = "none";
    }

    function showTool() {
        const toc = document.getElementById("toc");
        if (toc && toc.style.display !== "none") {
            closeToc();
        }
        
        var toolDiv = document.getElementById("toolDiv");
        if (toolDiv && toolDiv.style.display !== "none") {
            closeTool();
            return;
        }
        toolDiv.style.display = "block";
    }

    function closeTool() {
        var toolDiv = document.getElementById("toolDiv");
        toolDiv.style.display = "none";
    }

    function loadToc() {
        isLoadToc = true;
        
        var tocDiv = document.getElementById("toc");
        var viewerDiv = document.getElementById("viewer");

        var viewerRect = viewerDiv.getBoundingClientRect();

        tocDiv.style.top = viewerRect.top + "px";
        tocDiv.style.left = viewerRect.left + "px";
        tocDiv.style.height = (viewerRect.height -30) + "px";
        tocDiv.style.width = (viewerRect.width / 2) + "px";

        var tocList = document.getElementById("tocList");
        tocList.innerHTML = '';
        
        book.loaded.navigation.then(function(toc) {
            function createTocItem(chapter, level) {
                var li = document.createElement("li");
                var button = document.createElement("button");
                button.innerHTML = chapter.label;
                button.onclick = function() {
                    rendition.display(chapter.href);
                    closeToc();
                };

                li.style.paddingLeft = (level * 20) + "px";

                li.appendChild(button);
                tocList.appendChild(li);

                if (chapter.subitems) {
                    var subList = document.createElement("ul");
                    chapter.subitems.forEach(function(subitem) {
                        createTocItem(subitem, level + 1);
                    });
                    li.appendChild(subList);
                }
            }

            toc.forEach(function(chapter) {
                createTocItem(chapter, 0);
            });
        });
    }

    function adjustSelect(selectId, direction) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const options = Array.from(select.options);
        const currentIndex = select.selectedIndex;

        const newIndex = currentIndex + direction;

        if (newIndex >= 0 && newIndex < options.length) {
            select.selectedIndex = newIndex;
            select.dispatchEvent(new Event('change'));
        }
    }


    function createElements() {
        // Create toolButton
        const toolButton = document.createElement('div');
        toolButton.id = 'toolButton';
        toolButton.innerHTML = `
            <a id="setup_button">&nbsp;⚙</a>
            <a id="show_toc">▥</a>
        `;
        document.body.appendChild(toolButton);

        // Create toc
        const toc = document.createElement('div');
        toc.id = 'toc';
        toc.style.display = 'none';
        toc.innerHTML = `
            <button id="closeToc">×</button>
            <h3>目錄</h3>
            <ul id="tocList"></ul>
        `;
        document.body.appendChild(toc);

        // Create toolDiv
        const toolDiv = document.createElement('div');
        toolDiv.id = 'toolDiv';
        toolDiv.style.display = 'none';
        toolDiv.innerHTML = `
            <button id="closeTool">×</button>
            
            <h3>樣式調整</h3>
            <div id="tool_layout_div">
                <label for="layout">版式</label>
                <label>
                    <input type="radio" name="layout" value="auto" checked> 自動
                </label>
                <label>
                    <input type="radio" name="layout" value="none"> 單欄
                </label>
                <label>
                    <input type="radio" name="layout" value="always"> 雙欄
                </label>
            </div>
            
            <div id="tool_theme_div">
                <label for="theme">背景色</label>
                <label>
                    <input type="radio" name="theme" value="light" checked> 白色
                </label>
                <label>
                    <input type="radio" name="theme" value="mi"> 米色
                </label>
                <label>
                    <input type="radio" name="theme" value="dark"> 黑暗
                </label>
            </div>
            <div id="tool_lineHeigh_div">
                <label for="lineHeight">行距</label>
                <button class="adjust-btn">-</button>
                <select id="lineHeight">
                    <option value="unset">預設</option>
                    <option value="1">1</option>
                    <option value="1.5">1.5</option>
                    <option value="2">2</option>
                </select>
                <button class="adjust-btn">+</button>
            </div>
            <div id="tool_letterSpacing_div">
                <label for="letterSpacing">字距</label>
                <button class="adjust-btn">-</button>
                <select id="letterSpacing">
                    <option value="unset" selected>預設</option>
                    <option value="0.1em">0.1em</option>
                    <option value="0.2em">0.2em</option>
                    <option value="0.3em">0.3em</option>
                    <option value="0.4em">0.4em</option>
                    <option value="0.5em">0.5em</option>
                </select>
                <button class="adjust-btn">+</button>
            </div>
            <div id="tool_fontSize_div">
                <label for="fontSize">文字大小</label>
                <button class="adjust-btn">-</button>
                <select id="fontSize">
                    <option value="unset" selected>預設</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="22px">22px</option>
                    <option value="24px">24px</option>
                    <option value="26px">26px</option>
                    <option value="28px">28px</option>
                    <option value="30px">30px</option>
                </select>
                <button class="adjust-btn">+</button>
            </div>
        `;
        document.body.appendChild(toolDiv);

        // Create viewer_event
        const viewerEvent = document.createElement('div');
        viewerEvent.id = 'viewer_event';
        document.body.appendChild(viewerEvent);
    }

    function init(containerId, bookUrl) {
        createElements();
        try {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const target = document.querySelector(`input[name="theme"][value="${prefersDark ? 'dark' : 'light'}"]`);
        if (target) target.checked = true;
        } catch (_) {}
        document.addEventListener('DOMContentLoaded', function() {
            start(containerId, bookUrl);
            setupEventListeners();
        });
    }

    function setupEventListeners() {
        document.getElementById('setup_button').addEventListener('click', showTool);
        document.getElementById('show_toc').addEventListener('click', showToc);
        document.getElementById('closeToc').addEventListener('click', closeToc);
        document.getElementById('closeTool').addEventListener('click', closeTool);

        window.addEventListener('resize', debounce(setupTool, 150));
        window.addEventListener('orientationchange', debounce(setupTool, 150));

        // 鍵盤操作：← → 翻頁；ESC 關閉工具/目錄
        document.addEventListener('keydown', (e) => {
        const toolDiv = document.getElementById('toolDiv');
        const toc = document.getElementById('toc');

        if (e.key === 'Escape') {
            if (toolDiv && toolDiv.style.display !== 'none') closeTool();
            if (toc && toc.style.display !== 'none') closeToc();
            return;
        }
        if (toolDiv && toolDiv.style.display !== 'none') return;
        if (toc && toc.style.display !== 'none') return;

        if (e.key === 'ArrowRight') {
            // 依書向左至右/右至左決定方向（與你現有 click 判斷一致）
            if (pageProgressionDirection === 'rtl') {
            goToPreviousPage();
            } else {
            goToNextPage();
            }
        } else if (e.key === 'ArrowLeft') {
            if (pageProgressionDirection === 'rtl') {
            goToNextPage();
            } else {
            goToPreviousPage();
            }
        }
        });


        document.querySelectorAll('input[name="layout"]').forEach(input => {
            input.addEventListener('change', changeLayout);
        });
        document.querySelectorAll('input[name="theme"]').forEach(input => {
            input.addEventListener('change', changeTheme);
        });
        document.getElementById('lineHeight').addEventListener('change', changeLineHeight);
        document.getElementById('letterSpacing').addEventListener('change', changeLetterSpacing);
        document.getElementById('fontSize').addEventListener('change', changeFontSize);

        document.querySelectorAll('.adjust-btn').forEach(button => {
            button.addEventListener('click', function() {
                const selectId = this.parentElement.querySelector('select').id;
                const direction = this.textContent === '+' ? 1 : -1;
                adjustSelect(selectId, direction);
            });
        });

        var viewerEvent = document.getElementById("viewer_event");
        viewerEvent.addEventListener("click", function(event) {
            event.stopPropagation();

            var toolDiv = document.getElementById("toolDiv");
            var toc = document.getElementById("toc");
            if (toolDiv && toolDiv.style.display !== "none") {
                closeTool();
                return;
            }

            if (toc && toc.style.display !== "none") {
                closeToc();
                return;
            }

            var viewer = event.currentTarget;
            var rect = viewer.getBoundingClientRect();
            var clickX = event.clientX;

            if (clickX > rect.left + rect.width / 2) {
                if(pageProgressionDirection) {
                    if(pageProgressionDirection == 'ltr') {
                        goToNextPage();
                    } else if(pageProgressionDirection == 'rtl') {
                        goToPreviousPage();
                    }
                } else {
                    goToNextPage();
                }
            } else {
                if(pageProgressionDirection) {
                    if(pageProgressionDirection == 'ltr') {
                        goToPreviousPage();
                    } else if(pageProgressionDirection == 'rtl') {
                        goToNextPage();
                    }
                } else {
                    goToPreviousPage();
                }
            }
        });

        let startX = 0, startY = 0, endX = 0, endY = 0;

        viewerEvent.addEventListener("touchstart", function(event) {
            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        });

        viewerEvent.addEventListener("touchend", function(event) {
            const toolDiv = document.getElementById("toolDiv");
            const toc = document.getElementById("toc");

            if (toolDiv && toolDiv.style.display !== "none") {
                return;
            }

            if (toc && toc.style.display !== "none") {
                return;
            }

            const touch = event.changedTouches[0];
            endX = touch.clientX;
            endY = touch.clientY;

            const diffX = endX - startX;
            const diffY = endY - startY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 200) {
                if (diffX > 0) {
                    if(pageProgressionDirection) {
                        if(pageProgressionDirection == 'ltr') {
                            goToNextPage();
                        } else if(pageProgressionDirection == 'rtl') {
                            goToPreviousPage();
                        }
                    } else {
                        goToNextPage();
                    }
                } else {
                    if(pageProgressionDirection) {
                        if(pageProgressionDirection == 'ltr') {
                            goToPreviousPage();
                        } else if(pageProgressionDirection == 'rtl') {
                            goToNextPage();
                        }
                    } else {
                        goToPreviousPage();
                    }
                }
            }
        });

        document.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") {
                goToPreviousPage();
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                goToNextPage();
                event.preventDefault();
            } else {
                event.preventDefault();
            }
        });

        document.addEventListener("mousedown", function (event) {
            if (event.button !== 0 && event.button !== 2) {
                event.preventDefault();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                event.preventDefault();
            }
        });

        document.addEventListener("keypress", function (event) {
            event.preventDefault();
        });
    }

    window.EPUBReader = {
        init: init
    };
})();

function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
