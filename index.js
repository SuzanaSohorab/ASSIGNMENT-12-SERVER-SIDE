import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(process.env.MONGO_URI);
let postsCollection, usersCollection, commentsCollection, announcementsCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db("forumDB");

    postsCollection = db.collection("posts");
    usersCollection = db.collection("users");
    commentsCollection = db.collection("comments");
    announcementsCollection = db.collection("announcements");

    console.log("✅ MongoDB Connected!");
  } catch (error) {
    console.error(error);
  }
}
run();

// Example route
app.get("/", (req, res) => {
  res.send("Forum API running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
