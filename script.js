window.addEventListener("DOMContentLoaded", () => {
  const BOOKS_INDEX = "./books.json";
  const booksArea = document.getElementById("booksArea");
  const listEl = document.getElementById("list");
  const loader = document.getElementById("loader");
  const jsError = document.getElementById("jsErrorPlaceholder");
  const searchBooksInput = document.getElementById("searchBooks");
  const searchTopicsInput = document.getElementById("searchTopics");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const bookSelectionView = document.getElementById("book-selection-view");
  const topicView = document.getElementById("topic-view");
  const backToBooksBtn = document.getElementById("backToBooksBtn");
  const bookTitle = document.getElementById("bookTitle");
  const categoryNav = document.getElementById("category-nav");
  const categoryBackBtn = document.getElementById("categoryBackBtn");
  const breadcrumbs = document.getElementById("breadcrumbs");

  let booksIndex = [];
  let currentBook = null;
  let currentPath = [];
  let pathBeforeSearch = [];
  let isSearching = false;

  function showLoader() {
    loader.classList.remove("hidden");
  }

  function hideLoader() {
    loader.classList.add("hidden");
  }

  function showError(msg) {
    jsError.style.display = "block";
    jsError.textContent = msg;
  }

  function clearError() {
    jsError.style.display = "none";
    jsError.textContent = "";
  }

  function saveProgress(map, bookName) {
    localStorage.setItem("progress::" + bookName, JSON.stringify(map));
  }

  function loadProgress(bookName) {
    try {
      return JSON.parse(localStorage.getItem("progress::" + bookName) || "{}");
    } catch (e) {
      return {};
    }
  }

  function getSelectedProvider() {
    const selector = document.querySelector(".provider-btn.active");
    return selector ? selector.dataset.provider : "chatgpt";
  }

  function makeQueryUrl(topic, mode, provider, bookName) {
    const title = topic.title || "";
    const note = topic.note || "";
    let query = `You are a teacher and going to teach '${title}' in context of ${bookName}. Here is a note describing exactly what you have to teach and focus on: "${note}"`;
    const q = encodeURIComponent(query);
    switch (provider) {
      case "perplexity":
        return `https://www.perplexity.ai/search?q=${q}`;
      case "copilot":
        return `https://www.bing.com/search?q=${q}&showconv=1`;
      case "chatgpt":
      default:
        return `https://chatgpt.com/?q=${q}&ref=ext`;
    }
  }

  async function fetchJsonSafe(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok)
      throw new Error(
        `Failed to fetch ${url} — ${res.status} ${res.statusText}`
      );
    return res.json();
  }

  function resetBookButtonStyles() {
    document.querySelectorAll(".book-btn.active").forEach((b) => {
      b.classList.remove("active");
    });
  }

  function renderBookButtons(filter = "") {
    booksArea.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const filterLower = filter.toLowerCase();

    const createBookElement = (item) => {
      const btn = document.createElement("button");
      btn.className = "book-btn";
      if (item.children) {
        btn.classList.add("category");
        btn.innerHTML = `<h3>${item.name}</h3>`;
        if (!filter) {
          btn.addEventListener("click", () => {
            currentPath.push(item.name);
            renderBookButtons();
          });
        }
      } else {
        btn.innerHTML = `<h3>${item.name}</h3>`;
        btn.dataset.file = item.file || item.filename || item.path || "";
        btn.title = `Load book: ${item.name}`;
        btn.addEventListener("click", () => {
          resetBookButtonStyles();
          btn.classList.add("active");
          selectBook(item, btn);
        });
      }
      return btn;
    };

    if (filterLower) {
      const renderNode = (node) => {
        if (node.name.toLowerCase().includes(filterLower)) {
          return createBookElement(node);
        }
        if (node.children) {
          const children = node.children.map(renderNode).filter(Boolean);
          if (children.length > 0) {
            const categoryEl = createBookElement(node);
            const childrenContainer = document.createElement("div");
            childrenContainer.className = "bento-grid";
            children.forEach((child) => childrenContainer.appendChild(child));
            categoryEl.appendChild(childrenContainer);
            return categoryEl;
          }
        }
        return null;
      };
      booksIndex.forEach(node => {
        const el = renderNode(node);
        if(el) fragment.appendChild(el)
      });
    } else {
      let currentNode = { children: booksIndex };
      currentPath.forEach(
        (p) => (currentNode = currentNode.children.find((c) => c.name === p))
      );
      currentNode.children.forEach((item) => {
        fragment.appendChild(createBookElement(item));
      });
    }

    if (fragment.children.length === 0) {
      booksArea.innerHTML = `<p class="no-results">No books or categories found.</p>`;
    } else {
      booksArea.appendChild(fragment);
    }
    updateNavigationControls();
  }

  function updateNavigationControls() {
    const filterValue = searchBooksInput.value;
    categoryNav.style.display = currentPath.length > 0 && !filterValue ? "flex" : "none";

    breadcrumbs.innerHTML = "";
    const homeLink = document.createElement("a");
    homeLink.href = "#";
    homeLink.textContent = "Home";
    homeLink.addEventListener("click", (e) => {
      e.preventDefault();
      currentPath = [];
      renderBookButtons();
    });
    breadcrumbs.appendChild(homeLink);

    let pathAccumulator = [];
    currentPath.forEach((segment, index) => {
      pathAccumulator.push(segment);
      breadcrumbs.appendChild(document.createTextNode(" / "));
      if (index < currentPath.length - 1) {
        const pathLink = document.createElement("a");
        pathLink.href = "#";
        pathLink.textContent = segment;
        const currentSegmentPath = [...pathAccumulator];
        pathLink.addEventListener("click", (e) => {
          e.preventDefault();
          currentPath = currentSegmentPath;
          renderBookButtons();
        });
        breadcrumbs.appendChild(pathLink);
      } else {
        const currentSegmentSpan = document.createElement("span");
        currentSegmentSpan.textContent = segment;
        breadcrumbs.appendChild(currentSegmentSpan);
      }
    });
  }

  async function selectBook(book) {
    clearError();
    bookSelectionView.style.display = "none";
    topicView.style.display = "block";
    bookTitle.textContent = book.name;
    showLoader();
    try {
      const filePath = book.file || book.path || book.filename;
      if (!filePath) throw new Error("Book entry has no file path");
      listEl.innerHTML = "";
      const bookData = await fetchJsonSafe(filePath);
      currentBook = { name: book.name, file: filePath, data: bookData };
      renderTopics(bookData, filePath, book.name, "");
      searchTopicsInput.value = "";
    } catch (err) {
      console.error(err);
      showError(`Unable to load book: ${err.message || err}`);
    } finally {
      hideLoader();
    }
  }

  function topicsFrom(bookData) {
    return Array.isArray(bookData)
      ? bookData
      : bookData.topics || bookData.items || [];
  }

  function renderTopics(bookData, fileKey, bookName, filter = "") {
    let topics = topicsFrom(bookData);
    if (!Array.isArray(topics)) {
      showError("Book JSON format not recognized");
      return;
    }
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      topics = topics.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(lowerFilter) ||
          (t.note || "").toLowerCase().includes(lowerFilter)
      );
    }
    listEl.innerHTML = "";
    if (topics.length === 0) {
      listEl.innerHTML = `<p class="no-results">No topics found.</p>`;
      return;
    }
    const progress = loadProgress(bookName);
    topics.forEach((t) => {
      const num = t.n || t.id || t.index || "";
      const key = "t" + num;
      const checked = !!progress[key];
      const card = document.createElement("div");
      card.className = "topic-card";
      if(checked) card.classList.add('completed');
      
      card.innerHTML = `
        <div class="topic-card-header">
            <h5 class="topic-title">${t.title || "Untitled"}</h5>
            <div class="topic-actions">
                <span class="topic-number">#${num}</span>
                <input type="checkbox" id="cb-${num}" ${checked ? 'checked' : ''} />
            </div>
        </div>
        <p class="topic-note">${t.note || ""}</p>
        <div class="topic-buttons">
            <button class="search-btn"><i class="fas fa-search"></i> Search</button>
            <button class="study-btn"><i class="fas fa-book-open"></i> Study</button>
            <button class="copy-btn"><i class="far fa-clipboard"></i></button>
        </div>
      `;
      
      const cb = card.querySelector('input[type="checkbox"]');
      cb.addEventListener("change", (e) => {
        const p = loadProgress(bookName);
        p[key] = e.target.checked;
        saveProgress(p, bookName);
        card.classList.toggle("completed", e.target.checked);
      });

      const openAndCheck = (url) => {
          const p = loadProgress(bookName);
          p[key] = true;
          saveProgress(p, bookName);
          cb.checked = true;
          card.classList.add("completed");
          window.open(url, "_blank", "noopener");
      }

      const provider = getSelectedProvider();
      card.querySelector('.search-btn').addEventListener('click', () => openAndCheck(makeQueryUrl(t, "search", provider, bookName)));
      card.querySelector('.study-btn').addEventListener('click', () => openAndCheck(makeQueryUrl(t, "study", provider, bookName)));
      
      const copyBtn = card.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(t.note || "").then(() => {
            copyBtn.innerHTML = `<i class="fas fa-check"></i>`;
            setTimeout(() => { copyBtn.innerHTML = `<i class="far fa-clipboard"></i>`; }, 1500);
        });
      });

      listEl.appendChild(card);
    });

    document.getElementById("selectAll").onclick = () => {
      const p = {};
      topicsFrom(bookData).forEach((t) => {
        const id = t.n || t.id || t.index || "";
        if (id) p["t" + id] = true;
      });
      saveProgress(p, bookName);
      renderTopics(bookData, fileKey, bookName, filter);
    };
    document.getElementById("clearAll").onclick = () => {
      saveProgress({}, bookName);
      renderTopics(bookData, fileKey, bookName, filter);
    };
  }

  function handleScroll() {
    scrollTopBtn.style.display = (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) ? "block" : "none";
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  (async function init() {
    try {
      clearError();
      showLoader();
      const idx = await fetchJsonSafe(BOOKS_INDEX);
      booksIndex = Array.isArray(idx) ? idx : idx.books || idx.items || [];
      if (booksIndex.length === 0) {
        booksArea.innerHTML = '<p class="no-results">No books found.</p>';
        return;
      }
      renderBookButtons();
      searchBooksInput.addEventListener("input", (e) => {
        const filterValue = e.target.value;
        if (filterValue && !isSearching) {
            pathBeforeSearch = [...currentPath];
            isSearching = true;
        } else if (!filterValue && isSearching) {
            currentPath = [...pathBeforeSearch];
            pathBeforeSearch = [];
            isSearching = false;
        }
        renderBookButtons(filterValue);
      });
      searchTopicsInput.addEventListener("input", (e) => {
        if (currentBook) {
          renderTopics(currentBook.data, currentBook.file, currentBook.name, e.target.value);
        }
      });
      backToBooksBtn.addEventListener("click", () => {
        bookSelectionView.style.display = "block";
        topicView.style.display = "none";
        currentBook = null;
        resetBookButtonStyles();
      });
      categoryBackBtn.addEventListener('click', () => {
        if (currentPath.length > 0) {
            currentPath.pop();
            renderBookButtons();
        }
      });
      document.querySelectorAll(".provider-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".provider-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          if (currentBook) {
            renderTopics(currentBook.data, currentBook.file, currentBook.name, searchTopicsInput.value);
          }
        });
      });
      document.querySelector('.provider-btn[data-provider="chatgpt"]').classList.add('active');
      window.addEventListener("scroll", handleScroll);
      scrollTopBtn.addEventListener("click", scrollToTop);
    } catch (err) {
      console.error(err);
      showError(`Initialization failed: ${err.message || err}`);
    } finally {
      hideLoader();
    }
  })();
});
