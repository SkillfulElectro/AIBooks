<div align="center">
  <img src="Logos/AIBooks_logo.png" alt="logo" width="100" style="border-radius: 50%"/>
</div>

AIBooks is a simple and easy-to-use prompt book library for everyone. It provides a collection of AI-powered study guides on various technical subjects.

**Live Site:** https://skillfulelectro.github.io/AIBooks/

## Features

- **Wide Range of Topics:** Covers various subjects from programming languages to networking and more.
- **Interactive Learning:** Each topic includes notes that can be used with AI assistants like ChatGPT for interactive study sessions.
- **Progress Tracking:** Mark topics as complete and track your progress for each book.
- **Easy to Contribute:** Anyone can contribute by adding new books or improving existing ones.

## Getting Started

To run AIBooks locally, you can simply open the `index.html` file in your web browser. Since it's a client-side application, you don't need a web server.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/skillfulelectro/AIBooks.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd AIBooks
    ```
3.  **Open `index.html` in your browser:**
    - On macOS, you can use: `open index.html`
    - On Windows, you can use: `start index.html`
    - On Linux, you can use: `xdg-open index.html`

## How to Contribute

We welcome contributions! To add a new book or improve an existing one, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new branch:** `git checkout -b my-new-book`
3.  **Add your book to `books.json`:**
    - Add a new entry to the `books` array in `books.json`.
    - Make sure to keep the list sorted alphabetically by book name.
    ```json
    {
      "name": "My New Book",
      "file": "./books/my_new_book.json"
    }
    ```
4.  **Create a new JSON file for your book's content:**
    - Create a new file in the `books/` directory (e.g., `my_new_book.json`).
    - The file should contain an array of topic objects, each with `n`, `title`, `math`, and `note` fields.
    ```json
    [
      {
        "n": 1,
        "title": "Introduction to My New Book",
        "math": "Basic concepts",
        "note": "This is a note for the first topic."
      }
    ]
    ```
5.  **Commit your changes and push to your fork.**
6.  **Create a pull request.**

We appreciate your contributions to making AIBooks a great resource for everyone!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
