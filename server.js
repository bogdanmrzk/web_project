const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Налаштування збереження файлів за допомогою multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext; // Генерація унікального імені для файлу
    cb(null, filename);
  }
});

const upload = multer({ storage });

// Підключення до бази даних SQLite
let db = new sqlite3.Database('./db/shop.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Створення таблиці для товарів
db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price REAL,
    image TEXT
  )
`);

// Налаштування Express для обробки форм та статичних файлів
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Встановлення EJS як шаблонізатора
app.set('view engine', 'ejs');

// Головна сторінка (виведення всіх товарів)
app.get('/', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Database error');
    }
    
    // Передаємо дані в шаблон
    res.render('index', { products: rows });
  });
});

// Маршрут для адмін-панелі
app.get('/admin', (req, res) => {
  db.all("SELECT * FROM products", (err, rows) => {
    if (err) {
      return console.error(err.message);
    }
    // Передаємо список товарів в адмін панель
    res.render('admin', { products: rows });
  });
});

// Маршрут для редагування товару
app.get('/edit-product/:id', (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM products WHERE id = ?", [id], (err, product) => {
    if (err) {
      return console.error(err.message);
    }
    // Передаємо дані товару для редагування в шаблон
    res.render('edit-product', { product });
  });
});

// Маршрут для обробки редагування товару
app.post('/edit-product/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;

  // Якщо нове зображення завантажене, використовуємо його
  const image = req.file ? req.file.filename : null;

  // Якщо нове зображення не завантажене, зберігаємо старе зображення
  db.get("SELECT image FROM products WHERE id = ?", [id], (err, product) => {
    if (err) {
      return console.error(err.message);
    }

    const finalImage = image || product.image;  // Якщо немає нового зображення, використовуємо старе

    const updateData = [name, description, price, finalImage, id];
    const query = "UPDATE products SET name = ?, description = ?, price = ?, image = ? WHERE id = ?";

    db.run(query, updateData, function(err) {
      if (err) {
        return console.error(err.message);
      }
      res.redirect('/admin');
    });
  });
});

// Маршрут для видалення товару
app.get('/delete-product/:id', (req, res) => {
  const { id } = req.params;

  db.get("SELECT image FROM products WHERE id = ?", [id], (err, product) => {
    if (err) {
      return console.error(err.message);
    }

    // Видалення зображення товару, якщо воно існує
    if (product.image) {
      const imagePath = path.join(__dirname, 'public', 'uploads', product.image);
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error('Error deleting image:', err);
        }
      });
    }

    // Видалення товару з бази
    db.run("DELETE FROM products WHERE id = ?", [id], (err) => {
      if (err) {
        return console.error(err.message);
      }
      res.redirect('/admin');
    });
  });
});

// Маршрут для додавання нового товару
app.get('/add-product', (req, res) => {
  res.render('add-product');
});

// Маршрут для обробки форми додавання товару
app.post('/add-product', upload.single('image'), (req, res) => {
  const { name, description, price } = req.body;
  const image = req.file ? req.file.filename : null;

  // Збереження даних в базі
  const stmt = db.prepare("INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)");
  stmt.run(name, description, price, image, () => {
    res.redirect('/');
  });
  stmt.finalize();
});

// Маршрут для перегляду товару
app.get('/product/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Database error');
    }

    if (!product) {
      return res.status(404).send('Product not found');
    }

    res.render('product-detail', { product });
  });
});


// Запуск сервера
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
