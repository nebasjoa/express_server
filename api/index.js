import dotenv from 'dotenv'
import express, { json } from 'express'
import { createPool } from 'mariadb'
import cors from 'cors'
import argon2 from 'argon2'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
// import bodyParser from 'body-parser'
import jwt from 'jsonwebtoken'

dotenv.config();

const app = express();

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const port = process.env.PORT || 3000;
// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  },
});

const upload = multer({ storage });

// Route for handling image upload
app.post('/upload', upload.array('images', 10), (req, res) => {
  if (!req.files) {
    return res.status(400).send('No files uploaded.');
  }
  console.log('Express log: ' + req.files.filename)
  res.header("Access-Control-Allow-Origin", "*")
  res.status(200).send({ message: 'Files uploaded successfully!', files: req.files, imageUrl: `/uploads/${req.files[0]}` });
});

const corsOptions = {
  origin: '*',
  credentials: true,            //access-control-allow-credentials:true
  optionSuccessStatus: 200,
  allowedHeaders: '*'
}

app.use(cors(corsOptions))
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const JWT_SECRET = '7a;jxG0Jn"0FtDkutm9j'
// Set up connection pool for MariaDB
const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  connectionLimit: 5,
});

// Middleware
app.use(json());

// Test database connection
pool.getConnection()
  .then(conn => {
    console.log("Connected to MariaDB!")
    conn.release()
  })
  .catch(err => {
    console.error("Unable to connect to MariaDB:", err)
  });
/////////////////////////////////////////////
// Routes
app.post('/register', async (req, res) => {
  const { email, password, registration_date } = req.body
  try {
    const hashedPassword = await argon2.hash(password)
    const conn = await pool.getConnection();
    await conn.query("INSERT INTO users (email, password, registrationDate) VALUES (?, ?, ?)", [email, hashedPassword, registration_date])
    conn.release()
    res.status(201).json({ message: 'User registered successfully!' })
  } catch (error) {
    //console.log(error.sqlMessage)
    res.status(500).send({ error: error })
  }
});
//////////////////////////////////////////

app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const conn = await pool.getConnection()
    const hashedPassword = await conn.execute("SELECT * FROM users WHERE email = ?", [email])
    conn.release()
    if (await argon2.verify(hashedPassword[0].password, password)) {
      const token = jwt.sign({ username: email }, JWT_SECRET, { expiresIn: '1h' })
      res.status(201).json({ message: 'Login successfull!', token: token })
      console.log("Login ok.")
    } else {
      res.status(401).json({ message: 'Neispravna sifra.' })
    }
  } catch (error) {
    console.log(error)
    res.status(500).send({ error: error })
  }
});

// Create a new article
app.post('/articles', async (req, res) => {
  const { title, category, price, currency, period, article_id, user_id, date_created, location, images, description, firstName, lastName } = req.body;
  //console.log(req.body)
  try {
    const conn = await pool.getConnection();
    const article_query = "INSERT INTO articles (title, category, price, currency," + 
    "period, article_id, userId, dateCreated, city, images, description, ownerFirstName, ownerLastName)" + 
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    const result = await conn.query(article_query,
      [title, category, price, currency, period, article_id, user_id, date_created, location, images, description, firstName, lastName]);
    conn.release();
    res.status(201).json({ message: 'Article added successfully!' });
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
  }
});

app.get('/articles', async (req, res) => {
  try {
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM articles")
    conn.release()
    res.status(201).json({ rows: rows })
  } catch (error) {
    res.status(500).send("Error fetching products")
  }
});

app.get('/myarticles', async (req, res) => {
  try {
    const { user_id } = req.query;
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM articles WHERE userId = ?", [user_id])
    conn.release()
    res.status(201).json({ rows: rows })
  } catch (error) {
    res.status(500).send("Error fetching products")
  }
});

app.delete('/articles', async (req, res) => {
  try {
    const { article_id, user_id } = req.query;
    //console.log(req)
    const conn = await pool.getConnection()
    const rows = await conn.query("DELETE FROM articles WHERE article_id = ?", [article_id])
    conn.release()
    res.status(201).json({ rows: rows.toString() })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error deleting product.")
  }
});

app.get('/articles_search', async (req, res) => {
  try {
    const { title } = req.query
    const conn = await pool.getConnection()
    //const rows = await conn.query("SELECT * FROM articles WHERE title = ? ORDER BY id DESC", [title])
    const rows = await conn.query("SELECT * FROM articles")
    conn.release()
    //console.log(rows)
    res.status(201).json({ rows: rows })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error fetching products.")
  }
});

app.get('/articles_search_price', async (req, res) => {
  try {
    const { min_price, max_price } = req.query;
    //console.log(req.query)
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM articles WHERE price BETWEEN ? AND ? ORDER BY id DESC", [min_price, max_price])
    conn.release()
    //console.log(rows)
    res.status(201).json({ rows: rows })
  } catch (error) {
    res.status(500).send("Error fetching articles by price.")
  }
});

app.get('/articles_count/:article_id', async (req, res) => {
  try {
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM articles WHERE userId = (SELECT userId FROM articles where article_id = ?)", [req.params.article_id]);
    conn.release()
    //console.log(rows)    
    res.status(200).json({ rows: rows })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error fetching articles count.")
  }
});


app.get('/articles/:article_id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const row = await conn.query("SELECT * FROM articles WHERE article_id = ?", [req.params.article_id]);
    conn.release();
    //console.log(row)
    res.status(201).json(row);
  } catch (error) {
    res.status(500).send("Error fetching article");
  }
});


app.put('/articles/:id', async (req, res) => {
  const { article_title, article_id } = req.body;
  try {
    const conn = await pool.getConnection();
    await conn.query("UPDATE articles SET title = ? WHERE article_id = ?", [article_title, article_id]);
    conn.release();
    res.status(200).send("Article updated successfully");
  } catch (error) {
    res.status(500).send("Error updating product");
  }
});

app.get('/categories', async (req, res) => {
  try {
    const conn = await pool.getConnection()
    const categories = await conn.query("SELECT * FROM categories")
    // console.log(categories)
    conn.release()
    res.status(201).json({ categories: categories })
  } catch (error) {
    res.status(500).send("Error fetching categories")
  }
});


app.post('/wishlist_add/:article_id', async (req, res) => {
  const { article_id, user_id, article_owner } = req.body;
  console.log(req.body)
  try {
    const conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO wishlist (user_id, article_id, article_owner) VALUES (?, ?, ?)",
      [user_id, article_id, article_owner]);
    conn.release();
    res.status(201).json({ message: 'Article added to wishlist!' });
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
  }
});

app.get('/inquiry', async (req, res) => {
  const { user_id } = req.query;
  try {
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM inquires WHERE article_owner = ?", [user_id])
    conn.release()
    //console.log(rows)
    res.status(200).json({ rows: rows })
  } catch (error) {
    //console.log(error)
    res.status(500).send("Error fetching inquires.")
  }
});

app.get('/article_inquiry', async (req, res) => {
  const { article_id } = req.query;
  try {
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM inquires WHERE article_id = ?", [article_id])
    conn.release()
    //console.log(rows)
    res.status(200).json({ rows: rows })
  } catch (error) {
    //console.log(error)
    res.status(500).send("Error fetching inquires.")
  }
});

app.get('/sent_inquiries', async (req, res) => {
  const { user_id } = req.query;
  try {
    const conn = await pool.getConnection()
    const rows = await conn.query("SELECT * FROM inquires WHERE requested_by = ?", [user_id])
    conn.release()
    //console.log(rows)
    res.status(200).json({ rows: rows })
  } catch (error) {
    //console.log(error)
    res.status(500).send("Error fetching inquires.")
  }
});

app.post('/inquiry/', async (req, res) => {
  const { article_id, user_id, article_owner, startdate, enddate, days_total, inquiry_id, status } = req.body;
  //console.log(req.body)
  try {
    const conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO inquires (inquiry_id, article_id, requested_by, article_owner, from_date, to_date, days_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [inquiry_id, article_id, user_id, article_owner, startdate, enddate, days_total, status]);
    conn.release();
    res.status(201).json({ message: 'Upit poslat!' });
  } catch (error) {
    //console.log(error)
    res.status(500).send(error);
  }
});

app.put('/approve_inquiry', async (req, res) => {
  try {
    const { inquiry_id } = req.body.params;
    //console.log(req)
    const conn = await pool.getConnection()
    const rows = await conn.query("UPDATE inquires SET status = ? WHERE inquiry_id = ?", ['prihvaceno',inquiry_id])
    conn.release()
    res.status(200).json({ rows: rows.toString() })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error accepting inquiry.")
  }
});

app.delete('/delete_inquiry', async (req, res) => {
  try {
    const { inquiry_id } = req.query;
    //console.log(req)
    const conn = await pool.getConnection()
    const rows = await conn.query("DELETE FROM inquires WHERE inquiry_id = ?", [inquiry_id])
    conn.release()
    res.status(200).json({ rows: rows.toString() })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error deleting inquiry.")
  }
});

app.put('/decline_inquiry', async (req, res) => {
  try {
    const { inquiry_id } = req.body.params;
    //console.log(req)
    const conn = await pool.getConnection()
    const rows = await conn.query("UPDATE inquires SET status = ? WHERE inquiry_id = ?", ['odbijeno',inquiry_id])
    conn.release()
    res.status(200).json({ rows: rows.toString() })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error updating inquiry.")
  }
});

app.post('/archive_inquiry/', async (req, res) => {
  const { inquiry_id } = req.body.params;
  //console.log(req.body)
  try {
    const conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO inquires_archive SELECT * FROM inquires where inquiry_id = ?", [inquiry_id]);
    conn.release();
    res.status(201).json({ message: 'Inquiry archived!' });
  } catch (error) {
    //console.log(error)
    res.status(500).send(error);
  }
});

app.delete('/wishlist_remove/', async (req, res) => {
  const { article_id, user_id, article_owner } = req.query;
  // console.log(req.query)
  try {
    const conn = await pool.getConnection();
    const result = await conn.query("DELETE FROM wishlist WHERE user_id = ? AND article_id = ? AND article_owner = ?",
      [user_id, article_id, article_owner]);
    conn.release();
    res.status(201).json({ message: 'Article removed from wishlist!' });
  } catch (error) {
    console.log(error)
    res.status(500).send(error);
  }
});

app.get('/wishlist_articles', async (req, res) => {
  const { user_id } = req.query;
  // console.table(req.query)
  try {
    const conn = await pool.getConnection()                             // THIS IS NOT GUAD!
    const rows = await conn.query("SELECT * from articles WHERE article_id IN (SELECT article_id FROM wishlist WHERE user_id = ?)", [user_id])
    //console.log(rows)
    conn.release()
    res.status(201).json({ rows: rows })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error fetching products from wishlist.")
  }
});

app.get('/wishlist_check', async (req, res) => {
  const { user_id, article_id } = req.query;
  //console.table(req.query)
  try {
    const conn = await pool.getConnection()                             // THIS IS NOT GUAD!
    const rows = await conn.query("SELECT * from wishlist WHERE user_id = ? AND article_id = ?", [user_id, article_id])
    //console.log(rows)
    conn.release()
    res.status(201).json({ rows: rows })
  } catch (error) {
    console.log(error)
    res.status(500).send("Error fetching products from wishlist.")
  }
});




// Route to handle image uploads
app.post('/upload', upload.single('image'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    // Save image metadata in MariaDB
    const conn = await pool.getConnection();
    const query = 'INSERT INTO images (filename, filepath) VALUES (?, ?)';
    const filepath = path.join(__dirname, 'uploads', file.filename);
    await conn.query(query, [file.originalname, filepath]);
    conn.release();

    res.json({ message: 'File uploaded successfully.', filepath });
  } catch (error) {
    res.status(500).json({ message: 'Error saving file metadata.' });
  }
});








// FOF REFERENCE!!!!



// Get all products
app.get('/products', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const rows = await conn.query("SELECT * FROM articles");
    conn.release();
    res.json(rows);
  } catch (error) {
    res.status(500).send("Error fetching products");
  }
});

// Get product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const row = await conn.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
    conn.release();
    res.json(row[0] || null);
  } catch (error) {
    res.status(500).send("Error fetching product");
  }
});

// Create a new product
app.post('/products', async (req, res) => {
  const { name } = req.body;
  try {
    const conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO articles (title) VALUES (?)", [name]);
    conn.release();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).send("Error creating product");
  }
});

// Update a product
app.put('/products/:id', async (req, res) => {
  const { name, price, description } = req.body;
  try {
    const conn = await pool.getConnection();
    await conn.query("UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?", [name, price, description, req.params.id]);
    conn.release();
    res.send("Product updated successfully");
  } catch (error) {
    res.status(500).send("Error updating product");
  }
});

// Delete a product
app.delete('/products/:id', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    conn.release();
    res.send("Product deleted successfully");
  } catch (error) {
    res.status(500).send("Error deleting product");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
