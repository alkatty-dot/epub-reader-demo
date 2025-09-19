(function() {
    var isRendering = false; // Added: Track rendering state
    // === Preferences storage ===
    const STORE_KEY = 'epubReader.prefs';
    function savePrefs(patch){
        try{
            const cur = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(cur, patch)));
        }catch(e){}
    }
    function loadPrefs(){
        try{ return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }catch(e){ return {}; }
    }

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
        viewerEvent.style.top = (viewerRect.top + 100) + "px";
        viewerEvent.style.left = viewerRect.left + "px";
        viewerEvent.style.width = viewerRect.width + "px";
        viewerEvent.style.height = (viewerRect.height - 100) + "px";
        viewerEvent.style.display = 'block';
        
        var toc = document.getElementById("toc");
        if (toc.style.display == "block") {
            toc.style.left = (viewerRect.left + viewerRect.width - toc.getBoundingClientRect().width) + "px";
        }
        
        var toolDiv = document.getElementById("toolDiv");
        if (toolDiv.style.display == "block") {
            toolDiv.style.left = (viewerRect.left + viewerRect.width - toolDiv.getBoundingClientRect().width) + "px";
        }
    }

    function createTocItem(list, tocItem) {
        var listItem = document.createElement("li");
        var link = document.createElement("a");
        link.textContent = tocItem.label;
        link.href = "#";

        link.onclick = function() {
            isRendering = true;
            rendition.display(tocItem.href).then(() => {
                cfiString = rendition.currentLocation().start.cfi;
                isRendering = false;
                closeToc();
            }).catch(() => {
                console.error("頁面切換時發生錯誤");
                isRendering = false;
            });
            return false;
        };

        listItem.appendChild(link);

        if (tocItem.subitems && tocItem.subitems.length > 0) {
            var subList = document.createElement("ul");
            tocItem.subitems.forEach(subItem => {
                createTocItem(subList, subItem);
            });
            listItem.appendChild(subList);
        }
        list.appendChild(listItem);
    }

    var mouseDownX = 0;
    var mouseDownX2 = 0;
    function showToc() {
        var tocDiv = document.getElementById("toc");
        var viewerRect = document.getElementById("viewer").getBoundingClientRect();
        var width = tocDiv.getBoundingClientRect().width;
        
        tocDiv.style.top = viewerRect.top + "px";
        tocDiv.style.height = (viewerRect.height) + "px";
        tocDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
        tocDiv.style.display = "block";
        //tocDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
        
        mouseDownX = viewerRect.left + viewerRect.width - width;
        mouseDownX2 = viewerRect.left + viewerRect.width;
        
        var currentLeft = (viewerRect.left + viewerRect.width);
        var finalLeft = (viewerRect.left + viewerRect.width - width);
        var step = 30;
        
        function animateRightToLeft() {
            var left = currentLeft - step;
            if (left < finalLeft) {
                left = finalLeft;
            }
            tocDiv.style.left = left + "px";
            if (left > finalLeft) {
                requestAnimationFrame(animateRightToLeft);
            }
        }
        requestAnimationFrame(animateRightToLeft);
        
        var closeTocDiv = document.getElementById("closeTocDiv");
        closeTocDiv.addEventListener("mousedown", function (e) {
            mouseDownX = e.clientX;
            mouseDownX2 = e.clientX;
            var closeToc = document.getElementById("closeToc");
            closeToc.style.backgroundColor = 'rgb(64,64,64)';
            closeToc.style.color = 'white';
            e.preventDefault();
        });
        
        closeTocDiv.addEventListener("mousemove", function (e) {
            var newX = e.clientX; 
            if (mouseDownX == 0) return;
            var x = parseInt(tocDiv.style.left) ; 
            
            var width = tocDiv.getBoundingClientRect().width;
            var viewerRect = document.getElementById("viewer").getBoundingClientRect();
            if((x + (newX - mouseDownX)) < (viewerRect.left + viewerRect.width - width)) {
                tocDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
            } else if((x + (newX - mouseDownX)) > (viewerRect.left + viewerRect.width)) {
                tocDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
            } else {
                tocDiv.style.left = (x + (newX - mouseDownX)) + "px";
            }
            
            mouseDownX = newX; 
        });
        
        closeTocDiv.addEventListener("mouseup", function () {
            var closeToc = document.getElementById("closeToc");
            closeToc.style.backgroundColor = 'rgb(232,232,232)';
            closeToc.style.color = 'black';
            mouseDownX = 0;
            var x = parseInt(tocDiv.style.left) ; 
            
            var width = tocDiv.getBoundingClientRect().width;
            var viewerRect = document.getElementById("viewer").getBoundingClientRect();
            if((x + (mouseDownX2 - x)) > (viewerRect.left + viewerRect.width - width/2)) {
                tocDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
                tocDiv.style.display = "none";
                mouseDownX2 = 0;
            } else {
                tocDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
            }
        });
    }

    function closeToc() {
        var tocDiv = document.getElementById("toc");
        var viewerRect = document.getElementById("viewer").getBoundingClientRect();
        var width = tocDiv.getBoundingClientRect().width;
        var currentLeft = viewerRect.left + viewerRect.width - width;
        var finalLeft = viewerRect.left + viewerRect.width;
        var step = 20;

        function animateLeftToRight() {
            var left = currentLeft + step;
            if (left > finalLeft) {
                left = finalLeft;
            }
            tocDiv.style.left = left + "px";
            if (left < finalLeft) {
                requestAnimationFrame(animateLeftToRight);
            } else {
                tocDiv.style.display = "none";
            }
        }
        requestAnimationFrame(animateLeftToRight);
    }

    function showTool() {
        var toolDiv = document.getElementById("toolDiv");
        var viewerRect = document.getElementById("viewer").getBoundingClientRect();
        var width = toolDiv.getBoundingClientRect().width;
        
        toolDiv.style.top = viewerRect.top + "px";
        toolDiv.style.height = (viewerRect.height) + "px";
        toolDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
        toolDiv.style.display = "block";
        
        mouseDownX = viewerRect.left + viewerRect.width - width;
        mouseDownX2 = viewerRect.left + viewerRect.width;
        
        var currentLeft = (viewerRect.left + viewerRect.width);
        var finalLeft = (viewerRect.left + viewerRect.width - width);
        var step = 30;
        
        function animateRightToLeft() {
            var left = currentLeft - step;
            if (left < finalLeft) {
                left = finalLeft;
            }
            toolDiv.style.left = left + "px";
            if (left > finalLeft) {
                requestAnimationFrame(animateRightToLeft);
            }
        }
        requestAnimationFrame(animateRightToLeft);
        
        var closeToolDiv = document.getElementById("closeToolDiv");
        closeToolDiv.addEventListener("mousedown", function (e) {
            mouseDownX = e.clientX;
            mouseDownX2 = e.clientX;
            var closeTool = document.getElementById("closeTool");
            closeTool.style.backgroundColor = 'rgb(64,64,64)';
            closeTool.style.color = 'white';
            e.preventDefault();
        });
        
        closeToolDiv.addEventListener("mousemove", function (e) {
            var newX = e.clientX; 
            if (mouseDownX == 0) return;
            var x = parseInt(toolDiv.style.left) ; 
            
            var width = toolDiv.getBoundingClientRect().width;
            var viewerRect = document.getElementById("viewer").getBoundingClientRect();
            if((x + (newX - mouseDownX)) < (viewerRect.left + viewerRect.width - width)) {
                toolDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
            } else if((x + (newX - mouseDownX)) > (viewerRect.left + viewerRect.width)) {
                toolDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
            } else {
                toolDiv.style.left = (x + (newX - mouseDownX)) + "px";
            }
            
            mouseDownX = newX; 
        });
        
        closeToolDiv.addEventListener("mouseup", function () {
            var closeTool = document.getElementById("closeTool");
            closeTool.style.backgroundColor = 'rgb(232,232,232)';
            closeTool.style.color = 'black';
            mouseDownX = 0;
            var x = parseInt(toolDiv.style.left) ; 
            
            var width = toolDiv.getBoundingClientRect().width;
            var viewerRect = document.getElementById("viewer").getBoundingClientRect();
            if((x + (mouseDownX2 - x)) > (viewerRect.left + viewerRect.width - width/2)) {
                toolDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
                toolDiv.style.display = "none";
                mouseDownX2 = 0;
            } else {
                toolDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
            }
        });
    }

    function closeTool() {
        var toolDiv = document.getElementById("toolDiv");
        var viewerRect = document.getElementById("viewer").getBoundingClientRect();
        var width = toolDiv.getBoundingClientRect().width;
        var currentLeft = viewerRect.left + viewerRect.width - width;
        var finalLeft = viewerRect.left + viewerRect.width;
        var step = 20;

        function animateLeftToRight() {
            var left = currentLeft + step;
            if (left > finalLeft) {
                left = finalLeft;
            }
            toolDiv.style.left = left + "px";
            if (left < finalLeft) {
                requestAnimationFrame(animateLeftToRight);
            } else {
                toolDiv.style.display = "none";
            }
        }
        requestAnimationFrame(animateLeftToRight);
    }

    function createElements() {
        var tocDiv = document.createElement("div");
        tocDiv.id = "toc";
        tocDiv.style.display = "none";

        var closeTocDiv = document.createElement("div");
        closeTocDiv.id = "closeTocDiv";
        var closeToc = document.createElement("div");
        closeToc.id = "closeToc";
        closeToc.innerText = "目錄";
        closeTocDiv.appendChild(closeToc);

        var tocListDiv = document.createElement("div");
        tocListDiv.id = "tocList";
        var tocList = document.createElement("ul");
        tocList.id = "tocItems";
        tocListDiv.appendChild(tocList);

        tocDiv.appendChild(closeTocDiv);
        tocDiv.appendChild(tocListDiv);
        document.body.appendChild(tocDiv);

        var toolButton = document.createElement("div");
        toolButton.id = "toolButton";
        var toolBtnLeft = document.createElement("div");
        toolBtnLeft.id = "toolBtnLeft";
        toolBtnLeft.innerText = "目\n錄";
        var toolBtnRight = document.createElement("div");
        toolBtnRight.id = "toolBtnRight";
        toolBtnRight.innerText = "設\n定";
        toolButton.appendChild(toolBtnLeft);
        toolButton.appendChild(toolBtnRight);
        document.body.appendChild(toolButton);

        var toolDiv = document.createElement("div");
        toolDiv.id = "toolDiv";
        toolDiv.style.display = "none";

        var closeToolDiv = document.createElement("div");
        closeToolDiv.id = "closeToolDiv";
        var closeTool = document.createElement("div");
        closeTool.id = "closeTool";
        closeTool.innerText = "設定";
        closeToolDiv.appendChild(closeTool);

        var toolListDiv = document.createElement("div");
        toolListDiv.id = "toolList";

        var toolLineHeightDiv = document.createElement("div");
        toolLineHeightDiv.className = "toolItem";
        toolLineHeightDiv.id = "tool_lineHeigh_div";
        var lineHeightLabel = document.createElement("label");
        lineHeightLabel.innerText = "行高";
        var lineHeightSelect = document.createElement("select");
        lineHeightSelect.id = "lineHeight";
        var lineHeights = ["1.3", "1.5", "1.75", "2"];
        for (var i = 0; i < lineHeights.length; i++) {
            var option = document.createElement("option");
            option.value = lineHeights[i];
            option.text = lineHeights[i];
            if(lineHeights[i] == '1.5') option.selected = true;
            lineHeightSelect.appendChild(option);
        }
        var lineHeightAdjust = document.createElement("div");
        lineHeightAdjust.className = "tool-adjust";
        var lineHeightMinus = document.createElement("button");
        lineHeightMinus.className = "adjust-btn";
        lineHeightMinus.innerText = "-";
        var lineHeightPlus = document.createElement("button");
        lineHeightPlus.className = "adjust-btn";
        lineHeightPlus.innerText = "+";
        lineHeightAdjust.appendChild(lineHeightMinus);
        lineHeightAdjust.appendChild(lineHeightPlus);
        toolLineHeightDiv.appendChild(lineHeightLabel);
        toolLineHeightDiv.appendChild(lineHeightSelect);
        toolLineHeightDiv.appendChild(lineHeightAdjust);

        var toolLetterSpacingDiv = document.createElement("div");
        toolLetterSpacingDiv.className = "toolItem";
        toolLetterSpacingDiv.id = "tool_letterSpacing_div";
        var letterSpacingLabel = document.createElement("label");
        letterSpacingLabel.innerText = "字距";
        var letterSpacingSelect = document.createElement("select");
        letterSpacingSelect.id = "letterSpacing";
        var letterSpacings = ["0", "0.05em", "0.1em", "0.2em"];
        for (var i = 0; i < letterSpacings.length; i++) {
            var option = document.createElement("option");
            option.value = letterSpacings[i];
            option.text = letterSpacings[i];
            letterSpacingSelect.appendChild(option);
        }
        var letterSpacingAdjust = document.createElement("div");
        letterSpacingAdjust.className = "tool-adjust";
        var letterSpacingMinus = document.createElement("button");
        letterSpacingMinus.className = "adjust-btn";
        letterSpacingMinus.innerText = "-";
        var letterSpacingPlus = document.createElement("button");
        letterSpacingPlus.className = "adjust-btn";
        letterSpacingPlus.innerText = "+";
        letterSpacingAdjust.appendChild(letterSpacingMinus);
        letterSpacingAdjust.appendChild(letterSpacingPlus);
        toolLetterSpacingDiv.appendChild(letterSpacingLabel);
        toolLetterSpacingDiv.appendChild(letterSpacingSelect);
        toolLetterSpacingDiv.appendChild(letterSpacingAdjust);

        var toolFontSizeDiv = document.createElement("div");
        toolFontSizeDiv.className = "toolItem";
        toolFontSizeDiv.id = "tool_fontSize_div";
        var fontSizeLabel = document.createElement("label");
        fontSizeLabel.innerText = "字級";
        var fontSizeSelect = document.createElement("select");
        fontSizeSelect.id = "fontSize";
        var fontSizes = ["90%", "100%", "110%", "120%", "130%", "150%", "180%", "200%"];
        for (var i = 0; i < fontSizes.length; i++) {
            var option = document.createElement("option");
            option.value = fontSizes[i];
            option.text = fontSizes[i];
            if(fontSizes[i] == '110%') option.selected = true;
            fontSizeSelect.appendChild(option);
        }
        var fontSizeAdjust = document.createElement("div");
        fontSizeAdjust.className = "tool-adjust";
        var fontSizeMinus = document.createElement("button");
        fontSizeMinus.className = "adjust-btn";
        fontSizeMinus.innerText = "-";
        var fontSizePlus = document.createElement("button");
        fontSizePlus.className = "adjust-btn";
        fontSizePlus.innerText = "+";
        fontSizeAdjust.appendChild(fontSizeMinus);
        fontSizeAdjust.appendChild(fontSizePlus);
        toolFontSizeDiv.appendChild(fontSizeLabel);
        toolFontSizeDiv.appendChild(fontSizeSelect);
        toolFontSizeDiv.appendChild(fontSizeAdjust);

        var toolThemeDiv = document.createElement("div");
        toolThemeDiv.className = "toolItem";
        toolThemeDiv.id = "tool_theme_div";
        var themeLabel = document.createElement("label");
        themeLabel.innerText = "主題";
        var themeDiv = document.createElement("div");
        var themes = [
            { id: "light", value: "light", text: "亮色", checked: true },
            { id: "mi", value: "mi", text: "米黃" },
            { id: "dark", value: "dark", text: "暗色" }
        ];
        themes.forEach(function(theme) {
            var radioDiv = document.createElement("div");
            var radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "theme";
            radio.id = theme.id;
            radio.value = theme.value;
            if (theme.checked) radio.checked = true;

            var label = document.createElement("label");
            label.htmlFor = theme.id;
            label.innerText = theme.text;

            radioDiv.appendChild(radio);
            radioDiv.appendChild(label);
            themeDiv.appendChild(radioDiv);
        });
        toolThemeDiv.appendChild(themeLabel);
        toolThemeDiv.appendChild(themeDiv);

        var toolLayoutDiv = document.createElement("div");
        toolLayoutDiv.className = "toolItem";
        var layoutLabel = document.createElement("label");
        layoutLabel.innerText = "版面";
        var layoutDiv = document.createElement("div");
        var layouts = [
            { id: "auto", value: "auto", text: "自動", checked: true },
            { id: "none", value: "none", text: "單頁" },
            { id: "both", value: "both", text: "跨頁" }
        ];
        layouts.forEach(function(layout) {
            var radioDiv = document.createElement("div");
            var radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "layout";
            radio.id = layout.id;
            radio.value = layout.value;
            if (layout.checked) radio.checked = true;
            var label = document.createElement("label");
            label.htmlFor = layout.id;
            label.innerText = layout.text;
            radioDiv.appendChild(radio);
            radioDiv.appendChild(label);
            layoutDiv.appendChild(radioDiv);
        });
        toolLayoutDiv.appendChild(layoutLabel);
        toolLayoutDiv.appendChild(layoutDiv);

        toolListDiv.appendChild(toolThemeDiv);
        toolListDiv.appendChild(toolLineHeightDiv);
        toolListDiv.appendChild(toolLetterSpacingDiv);
        toolListDiv.appendChild(toolFontSizeDiv);
        toolListDiv.appendChild(toolLayoutDiv);
        toolDiv.appendChild(closeToolDiv);
        toolDiv.appendChild(toolListDiv);
        document.body.appendChild(toolDiv);

        var viewerEvent = document.createElement("div");
        viewerEvent.id = "viewer_event";
        viewerEvent.innerText = "";
        viewerEvent.style.display = "none";
        document.body.appendChild(viewerEvent);
    }

    var book; 
    var rendition; 
    var cfiString; 
    var pageProgressionDirection;    
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
            // Load saved preferences and sync UI before applying
            (function(){
                const prefs = loadPrefs();
                try {
                    if (prefs.theme) {
                        const radio = document.querySelector(`input[name="theme"][value="${prefs.theme}"]`);
                        if (radio) radio.checked = true;
                    }
                    if (prefs.layout) {
                        const radioL = document.querySelector(`input[name="layout"][value="${prefs.layout}"]`);
                        if (radioL) radioL.checked = true;
                    }
                    if (prefs.fontSize) {
                        const sel = document.getElementById("fontSize");
                        if (sel) sel.value = prefs.fontSize;
                    }
                    if (prefs.lineHeight) {
                        const sel = document.getElementById("lineHeight");
                        if (sel) sel.value = prefs.lineHeight;
                    }
                    if (prefs.letterSpacing) {
                        const sel = document.getElementById("letterSpacing");
                        if (sel) sel.value = prefs.letterSpacing;
                    }
                } catch(e){}
            })();

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

            function updateCFI() {
                try {
                    var location = rendition.currentLocation();
                    if (location && location.start && location.start.cfi) {
                        cfiString = location.start.cfi;
                    } else {
                        console.warn("目前位置沒有有效的 CFI");
                    }
                } catch (e) {
                    console.error("取得 CFI 時發生錯誤", e);
                }
            }
            rendition.on("rendered", updateCFI);
        }).catch(function(e) {
            console.error("Book loading failed:", e);
        });

        if (!window.isLoadToc) {
            window.isLoadToc = true;
            loadToc();
        }
    }

    function loadToc() {
        var tocList = document.getElementById("tocItems");
        
        if (book && book.navigation) {
            for (var i = 0; i < book.navigation.toc.length; i++) {
                createTocItem(tocList, book.navigation.toc[i]);
            }
        } else {
            book.loaded.navigation.then(function(toc) {
                for (var i = 0; i < toc.toc.length; i++) {
                    createTocItem(tocList, toc.toc[i]);
                }
            }).catch(function(e) {
                console.error(e);
            });
        }
    }

    function changeFontSize() {
        var selectedFontSize = document.getElementById("fontSize").value;
        rendition.themes.fontSize(selectedFontSize);
        savePrefs({ fontSize: document.getElementById('fontSize').value });
    }
    
    function changeTheme() {
        var theme = document.querySelector('input[name="theme"]:checked').value;
        var toolButton = document.getElementById("toolButton");
        
        if (toolButton) {
            if (theme === 'dark') {
                toolButton.style.color = 'white';
            } else {
                toolButton.style.color = 'black';
            }
        }
        rendition.themes.select(theme);
        savePrefs({ theme: document.querySelector('input[name="theme"]:checked').value });
    }

    function changeLineHeight() {
        var selectedLineHeight = document.getElementById("lineHeight").value;
        rendition.themes.default({"*":{"line-height": selectedLineHeight}});
        rendition.themes.update('default');
        savePrefs({ lineHeight: document.getElementById('lineHeight').value });
    }

    function changeLetterSpacing() {
        var selectedLetterSpacing = document.getElementById("letterSpacing").value;
        rendition.themes.default({"body":{"letter-spacing": selectedLetterSpacing}});
        rendition.themes.update('default');
        savePrefs({ letterSpacing: document.getElementById('letterSpacing').value });
    }

    function changeLayout() {
        var layout = document.querySelector('input[name="layout"]:checked').value;
        savePrefs({ layout: document.querySelector('input[name="layout"]:checked').value });
        var viewer = document.getElementById("viewer");
        viewer.innerHTML = "";
        start("viewer", "book2/item/standard.opf");
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

    function adjustSelect(selectId, direction) {
        const select = document.getElementById(selectId);
        const options = Array.from(select.options).map(o => o.value);
        const currentIndex = options.indexOf(select.value);
        const newIndex = Math.min(Math.max(0, currentIndex + direction), options.length - 1);

        select.value = options[newIndex];
        select.dispatchEvent(new Event('change'));
    }

    function init(containerId, bookUrl) {
        createElements();
        setupEventListeners();
        start(containerId, bookUrl);
    }

    function setupEventListeners() {
        document.getElementById('setup_button').addEventListener('click', showTool);
        document.getElementById('show_toc').addEventListener('click', showToc);
        document.getElementById('closeToc').addEventListener('click', closeToc);
        document.getElementById('closeTool').addEventListener('click', closeTool);

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
                }
            } else {
                if(pageProgressionDirection) {
                    if(pageProgressionDirection == 'ltr') {
                        goToPreviousPage();
                    } else if(pageProgressionDirection == 'rtl') {
                        goToNextPage();
                    }
                }
            }
        });

        document.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });

        document.addEventListener("keydown", function (event) {
            const tag = (event.target && event.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

            if (event.key === "ArrowLeft") {
                if (pageProgressionDirection === 'rtl') { goToNextPage(); } else { goToPreviousPage(); }
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                if (pageProgressionDirection === 'rtl') { goToPreviousPage(); } else { goToNextPage(); }
                event.preventDefault();
            } else if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
                var sel = document.getElementById('fontSize');
                if (sel) { 
                    var opts = Array.from(sel.options).map(o=>o.value);
                    var idx = Math.max(0, opts.indexOf(sel.value));
                    if (idx < opts.length-1) { sel.value = opts[idx+1]; changeFontSize(); }
                }
                event.preventDefault();
            } else if ((event.ctrlKey || event.metaKey) && event.key === '-') {
                var sel = document.getElementById('fontSize');
                if (sel) { 
                    var opts = Array.from(sel.options).map(o=>o.value);
                    var idx = Math.max(0, opts.indexOf(sel.value));
                    if (idx > 0) { sel.value = opts[idx-1]; changeFontSize(); }
                }
                event.preventDefault();
            }
        });

        document.addEventListener("keypress", function (event) {
            const tag = (event.target && event.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
            event.preventDefault();
        });
    }

    window.EPUBReader = {
        init: init
    };
})();
