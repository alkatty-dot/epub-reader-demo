// 範例資料（把這個陣列換成你的完整 booksData）
    

    // 取得 URL query param
    function getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    }

    // 找到符合 id 的書籍物件
    function findBookById(id) {
      if (id === null) return null;
      // 優先嘗試數字比對 number 屬性
      const n = parseInt(id, 10);
      if (!isNaN(n)) {
        const byNum = booksData.find(b => b.number === n);
        if (byNum) return byNum;
      }
      // 若 number 比對失敗，嘗試把 id 當字串比對 number 或可能的 id 欄位
      const byStr = booksData.find(b => String(b.number) === id || String(b.id) === id);
      return byStr || null;
    }

    var selected_book;
    
    // 主要流程
    (function() {
      const statusEl = document.getElementById('status');
      const id = getQueryParam('id');

      if (!id) {
        statusEl.innerHTML = '<p class="error">缺少參數：id。</p>';
        return;
      }

      const book = findBookById(id);

      selected_book = book;
      if (!book) {
        alert('找不到 id=' + id + ' 的書籍資料。');
        location.href='index.html';
        return;
      }

      if (!book.file || typeof book.file !== 'string') {
        alert('書籍資料缺少 file 欄位');
        location.href='index.html';
        return;
      }

      // 解析副檔名（取最後一個 . 之後的部分）
//       const fileName = book.file.trim();
//       alert(fileName)
//       const idx = fileName.lastIndexOf('.');
//       if (idx === -1) {
//         statusEl.innerHTML = '<p class="error">檔名沒有副檔名：' + fileName + '。</p>';
//         return;
//       }

//       const ext = fileName.substring(idx + 1).toLowerCase();

//       // 依副檔名導向，要求 302 類型的導向：用 location.replace 以避免在 history 留下一筆（可改為 href）
//       if (ext === 'epub') {
//         statusEl.innerHTML = '<p class="info">偵測到 EPUB，準備導向 epub.html?id=' + encodeURIComponent(id) + ' …</p>';
//         // Client-side redirect (browser navigation). Server 302 is not possible from client-side,
//         // but this will produce a navigation equivalent to an HTTP redirect.
//         window.location.replace('epub.html?id=' + encodeURIComponent(id));
//       } else if (ext === 'pdf') {
//         statusEl.innerHTML = '<p class="info">偵測到 PDF，準備導向 pdf.html?id=' + encodeURIComponent(id) + ' …</p>';
//         window.location.replace('pdf.html?id=' + encodeURIComponent(id));
//       } else {
//         statusEl.innerHTML = '<p class="error">不支援的檔案類型：.' + ext + '（檔名：' + fileName + '）</p>';
//       }
		do_logic();
    })();