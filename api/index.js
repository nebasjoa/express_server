import dotenv from 'dotenv'
import express, { json } from 'express'
import { createPool } from 'mariadb'
import cors from 'cors'
import argon2 from 'argon2'

dotenv.config();

const app = express();
const port = 3000;

const corsOptions = {
  origin: '*',
  credentials: true,            //access-control-allow-credentials:true
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))

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

app.get("/", (req, res) => res.send("Express on Vercel Yes!"));

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
  const { email, password } = req.body
  try {
    const hashedPassword = await argon2.hash(password)
    const conn = await pool.getConnection();
    const rows = await conn.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword])
    conn.release()
    res.status(201).json({ message: 'User registered successfully!' })
  } catch (error) {
    //console.log(error.sqlMessage)
    res.status(500).send({ error: error })
  }
});
//////////////////////////////////////////
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
  console.log("Server is running on port 3000.");
});

module.exports = app;