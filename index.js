// server.js
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Simple forum website is running");
});

// MongoDB connection
const uri =
  "mongodb+srv://forumDB:XnSo18x87U52j8HG@cluster0.joiywm2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const userCollection = client.db("forumDB").collection("users");
    const postCollection = client.db("forumDB").collection("posts");
    const commentCollection = client.db("forumDB").collection("comments");

    // Create a new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log("Data in server:", user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // ✅ Create a new post
    app.post("/posts", async (req, res) => {
      const post = {
        ...req.body,
        createdAt: new Date(),
        upVote: 0,
        downVote: 0,
      };
      const result = await postCollection.insertOne(post);
      res.send(result);
    });

    // ✅ Get all posts (newest first)
    app.get("/posts", async (req, res) => {
      const posts = await postCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(posts);
    });

    // ✅ Sort posts by popularity (upVote - downVote)
    app.get("/posts/popular", async (req, res) => {
      const posts = await postCollection
        .aggregate([
          { $addFields: { voteDifference: { $subtract: ["$upVote", "$downVote"] } } },
          { $sort: { voteDifference: -1 } },
        ])
        .toArray();
      res.send(posts);
    });

    // ✅ Add a comment to a post
    app.post("/comments", async (req, res) => {
      const comment = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await commentCollection.insertOne(comment);
      res.send(result);
    });

    // ✅ Get comments for a post
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const comments = await commentCollection.find({ postId }).toArray();
      res.send(comments);
    });

    // ✅ Get all posts by a user
    app.get("/api/posts/user/:email", async (req, res) => {
      try {
        const posts = await postCollection
          .find({ authorEmail: req.params.email })
          .toArray(); // <-- convert cursor to array
        res.json(posts);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Delete a post by ID
    app.delete("/api/posts/:id", async (req, res) => {
      try {
        const result = await postCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        if (result.deletedCount === 0)
          return res.status(404).json({ message: "Post not found" });
        res.json({ message: "Post deleted successfully" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Ping to confirm connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. MongoDB is connected.");
  } finally {
    // Optional: do not close client here if server keeps running
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Forum website is running on port ${port}`);
});
