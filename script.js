window.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
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

  // --- State ---
  const state = {
    booksIndex: [],
    currentBook: null,
    currentPath: [],
    pathBeforeSearch: [],
    isSearching: false,
  };

  // --- Constants ---
  const BOOKS_INDEX_URL = "./books.json";

  // --- Utility Functions ---
  const showLoader = () => loader.classList.remove("hidden");
  const hideLoader = () => loader.classList.add("hidden");

  function showError(msg) {
    jsError.style.display = "block";
    jsError.textContent = msg;
  }

  function clearError() {
    jsError.style.display = "none";
    jsError.textContent = "";
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url} — ${res.status} ${res.statusText}`);
      }
      return res.json();
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  }

  // --- Data Access Helpers ---
  const getBookFilePath = (book) => book.file || book.path || book.filename || "";
  const getTopicsFromBook = (bookData) => (Array.isArray(bookData) ? bookData : bookData.topics || bookData.items || []);
  const getTopicId = (topic) => topic.n || topic.id || topic.index || "";
  const getTopicKey = (topic) => `t${getTopicId(topic)}`;

  // --- Local Storage ---
  function saveProgress(map, bookName) {
    localStorage.setItem(`progress::${bookName}`, JSON.stringify(map));
  }

  function loadProgress(bookName) {
    try {
      return JSON.parse(localStorage.getItem(`progress::${bookName}`) || "{}");
    } catch (e) {
      return {};
    }
  }

  // --- Query Generation ---
  function getSelectedProvider() {
    const selector = document.querySelector(".provider-btn.active");
    return selector ? selector.dataset.provider : "chatgpt";
  }

  function makeQueryUrl(topic, provider, bookName) {
    const title = topic.title || "";
    const note = topic.note || "";
    const query = `You are a teacher and going to teach '${title}' in context of ${bookName}. Here is a note describing exactly what you have to teach and focus on: "${note}"`;
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
  
  // --- Rendering ---

  function createBookElement(item, isSearch) {
    const btn = document.createElement("button");
    btn.className = "book-btn";
    btn.innerHTML = `<h3>${item.name}</h3>`;

    if (item.children) {
        btn.classList.add("category");
        if (!isSearch) {
            btn.addEventListener("click", () => {
                state.currentPath.push(item.name);
                scrollToTop();
                renderBookButtons();
            });
        }
    } else {
        btn.dataset.file = getBookFilePath(item);
        btn.title = `Load book: ${item.name}`;
        btn.addEventListener("click", () => {
            document.querySelectorAll('.book-btn.active').forEach(b => b.classList.remove('active'));
            btn.classList.add("active");
            selectBook(item);
        });
    }
    return btn;
  }

  function renderFilteredBooks(filter) {
      const fragment = document.createDocumentFragment();
      const filterLower = filter.toLowerCase();

      const renderNode = (node) => {
          const el = createBookElement(node, true);
          let matches = node.name.toLowerCase().includes(filterLower);
          
          if (node.children) {
              const children = node.children.map(renderNode).filter(Boolean);
              if (children.length > 0) {
                  matches = true;
                  const childrenContainer = document.createElement("div");
                  childrenContainer.className = "bento-grid";
                  children.forEach((child) => childrenContainer.appendChild(child));
                  el.appendChild(childrenContainer);
              }
          }
          return matches ? el : null;
      };

      state.booksIndex.forEach(node => {
          const el = renderNode(node);
          if (el) fragment.appendChild(el);
      });
      return fragment;
  }

  function renderCategoryView() {
      const fragment = document.createDocumentFragment();
      let currentNode = { children: state.booksIndex };
      
      try {
        state.currentPath.forEach((p) => {
            currentNode = currentNode.children.find((c) => c.name === p);
            if (!currentNode) throw new Error(`Invalid path segment: ${p}`);
        });
        currentNode.children.forEach((item) => {
            fragment.appendChild(createBookElement(item, false));
        });
      } catch (error) {
        showError(error.message);
        state.currentPath = []; // Reset path
      }
      return fragment;
  }

  function renderBookButtons(filter = "") {
      booksArea.innerHTML = "";
      const fragment = filter ? renderFilteredBooks(filter) : renderCategoryView();

      if (fragment.children.length === 0) {
          booksArea.innerHTML = `<p class="no-results">No books or categories found.</p>`;
      } else {
          booksArea.appendChild(fragment);
      }
      updateNavigationControls();
  }

  function updateNavigationControls() {
    const filterValue = searchBooksInput.value;
    categoryNav.style.display = state.currentPath.length > 0 && !filterValue ? "flex" : "none";

    breadcrumbs.innerHTML = "";
    const homeLink = document.createElement("a");
    homeLink.href = "#";
    homeLink.textContent = "Home";
    homeLink.addEventListener("click", (e) => {
      e.preventDefault();
      state.currentPath = [];
      renderBookButtons();
    });
    breadcrumbs.appendChild(homeLink);

    let pathAccumulator = [];
    state.currentPath.forEach((segment, index) => {
      pathAccumulator.push(segment);
      breadcrumbs.appendChild(document.createTextNode(" / "));
      if (index < state.currentPath.length - 1) {
        const pathLink = document.createElement("a");
        pathLink.href = "#";
        pathLink.textContent = segment;
        const currentSegmentPath = [...pathAccumulator];
        pathLink.addEventListener("click", (e) => {
          e.preventDefault();
          state.currentPath = currentSegmentPath;
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
      const filePath = getBookFilePath(book);
      if (!filePath) throw new Error("Book entry has no file path");
      listEl.innerHTML = "";
      const bookData = await fetchJsonSafe(filePath);
      state.currentBook = { name: book.name, file: filePath, data: bookData };
      renderTopics();
      searchTopicsInput.value = "";

      // Scroll to last completed topic or top of view
      setTimeout(() => {
        const completedTopics = document.querySelectorAll('.topic-card.completed');
        if (completedTopics.length > 0) {
          completedTopics[completedTopics.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          topicView.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);

    } catch (err) {
      showError(`Unable to load book: ${err.message || ""}`);
    } finally {
      hideLoader();
    }
  }

  function renderTopics(filter = "") {
    const { name: bookName, data: bookData } = state.currentBook;
    let topics = getTopicsFromBook(bookData);
    
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

    const fragment = document.createDocumentFragment();
    const progress = loadProgress(bookName);

    topics.forEach((t) => {
      const topicId = getTopicId(t);
      const topicKey = getTopicKey(t);
      const isCompleted = !!progress[topicKey];
      
      const card = document.createElement("div");
      card.className = `topic-card ${isCompleted ? 'completed' : ''}`;
      
      card.innerHTML = `
        <div class="topic-card-header">
            <h5 class="topic-title">${t.title || "Untitled"}</h5>
            <div class="topic-actions">
                <span class="topic-number">#${topicId}</span>
                <input type="checkbox" id="cb-${topicId}" ${isCompleted ? 'checked' : ''} />
            </div>
        </div>
        <p class="topic-note">${t.note || ""}</p>
        <div class="topic-buttons">
            <button class="search-btn"><i class="fas fa-search"></i> Search</button>
            <button class="study-btn"><i class="fas fa-book-open"></i> Study</button>
            <button class="copy-btn"><i class="far fa-clipboard"></i></button>
        </div>
      `;

      if (t.math) {
        const mathEl = document.createElement('div');
        mathEl.className = 'math';
        mathEl.textContent = t.math;
        card.querySelector('.topic-card-header').after(mathEl);
      }
      
      // --- Event Listeners for Topic Card ---
      const checkbox = card.querySelector('input[type="checkbox"]');
      checkbox.addEventListener("change", (e) => {
        const p = loadProgress(bookName);
        p[topicKey] = e.target.checked;
        saveProgress(p, bookName);
        card.classList.toggle("completed", e.target.checked);
      });

      const openAndCheck = (url) => {
          const p = loadProgress(bookName);
          p[topicKey] = true;
          saveProgress(p, bookName);
          checkbox.checked = true;
          card.classList.add("completed");
          window.open(url, "_blank", "noopener");
      };

      const provider = getSelectedProvider();
      card.querySelector('.search-btn').addEventListener('click', () => openAndCheck(makeQueryUrl(t, provider, bookName)));
      card.querySelector('.study-btn').addEventListener('click', () => openAndCheck(makeQueryUrl(t, provider, bookName)));
      
      const copyBtn = card.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(t.note || "").then(() => {
            copyBtn.innerHTML = `<i class="fas fa-check"></i>`;
            setTimeout(() => { copyBtn.innerHTML = `<i class="far fa-clipboard"></i>`; }, 1500);
        });
      });

      fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
  }

  function setupTopicControls() {
    const { name: bookName, data: bookData } = state.currentBook;
    document.getElementById("selectAll").onclick = () => {
      const p = {};
      getTopicsFromBook(bookData).forEach((t) => {
        const key = getTopicKey(t);
        if (key) p[key] = true;
      });
      saveProgress(p, bookName);
      renderTopics(searchTopicsInput.value);
    };
    document.getElementById("clearAll").onclick = () => {
      saveProgress({}, bookName);
      renderTopics(searchTopicsInput.value);
    };
  }

  // --- Scroll Handling ---
  function handleScroll() {
    scrollTopBtn.style.display = (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) ? "block" : "none";
  }
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- Initialization ---
  async function init() {
    try {
      clearError();
      showLoader();
      
      const idx = await fetchJsonSafe(BOOKS_INDEX_URL);
      state.booksIndex = Array.isArray(idx) ? idx : idx.books || idx.items || [];
      
      if (state.booksIndex.length === 0) {
        booksArea.innerHTML = '<p class="no-results">No books found.</p>';
        return;
      }
      
      renderBookButtons();
      
      // --- Event Listeners ---
      searchBooksInput.addEventListener("input", (e) => {
        const filterValue = e.target.value;
        if (filterValue && !state.isSearching) {
            state.pathBeforeSearch = [...state.currentPath];
            state.isSearching = true;
        } else if (!filterValue && state.isSearching) {
            state.currentPath = [...state.pathBeforeSearch];
            state.pathBeforeSearch = [];
            state.isSearching = false;
        }
        renderBookButtons(filterValue);
      });

      searchTopicsInput.addEventListener("input", (e) => {
        if (state.currentBook) {
          renderTopics(e.target.value);
        }
      });

      backToBooksBtn.addEventListener("click", () => {
        bookSelectionView.style.display = "block";
        topicView.style.display = "none";
        state.currentBook = null;
        state.currentPath = [];
        renderBookButtons();
      });

      categoryBackBtn.addEventListener('click', () => {
        if (state.currentPath.length > 0) {
            state.currentPath.pop();
            renderBookButtons();
        }
      });

      document.querySelectorAll(".provider-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".provider-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          if (state.currentBook) {
            renderTopics(searchTopicsInput.value);
          }
        });
      });
      document.querySelector('.provider-btn[data-provider="chatgpt"]').classList.add('active');

      window.addEventListener("scroll", handleScroll);
      scrollTopBtn.addEventListener("click", scrollToTop);

    } catch (err) {
      showError(`Initialization failed: ${err.message || err}`);
    } finally {
      hideLoader();
    }
  }

  init();
});
