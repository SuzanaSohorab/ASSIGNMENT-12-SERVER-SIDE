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

    // ✅ Create a new user
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Create a new post
    app.post("/posts", async (req, res) => {
      try {
        const { authorEmail, ...rest } = req.body;

        // Find user to attach profile image if exists
        const user = await userCollection.findOne({ email: authorEmail });

        const post = {
          ...rest,
          authorEmail,
          authorImage: user?.photo || rest.authorImage || null,
          createdAt: new Date(),
          upVote: 0,
          downVote: 0,
        };

        const result = await postCollection.insertOne(post);
        res.send(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Get all posts (newest first, with pagination + comment count)
    app.get("/posts", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const posts = await postCollection
          .aggregate([
            {
              $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "postId",
                as: "comments",
              },
            },
            {
              $addFields: {
                commentCount: { $size: "$comments" },
              },
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ])
          .toArray();

        const totalPosts = await postCollection.countDocuments();
        res.json({
          posts,
          totalPages: Math.ceil(totalPosts / limit),
          currentPage: page,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Sort posts by popularity (upVote - downVote) with pagination + comment count
    app.get("/posts/popular", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const posts = await postCollection
          .aggregate([
            {
              $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "postId",
                as: "comments",
              },
            },
            {
              $addFields: {
                commentCount: { $size: "$comments" },
                voteDifference: { $subtract: ["$upVote", "$downVote"] },
              },
            },
            { $sort: { voteDifference: -1 } },
            { $skip: skip },
            { $limit: limit },
          ])
          .toArray();

        const totalPosts = await postCollection.countDocuments();
        res.json({
          posts,
          totalPages: Math.ceil(totalPosts / limit),
          currentPage: page,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Get post count for a user (for AddPost.jsx limit)
    app.get("/posts/count/:email", async (req, res) => {
      try {
        const count = await postCollection.countDocuments({
          authorEmail: req.params.email,
        });
        res.json({ count });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Add a comment to a post
    app.post("/comments", async (req, res) => {
      try {
        const comment = {
          ...req.body,
          createdAt: new Date(),
        };
        const result = await commentCollection.insertOne(comment);
        res.send(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Get comments for a post
    app.get("/comments/:postId", async (req, res) => {
      try {
        const postId = req.params.postId;
        const comments = await commentCollection
          .find({ postId })
          .toArray();
        res.send(comments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Get all posts by a user
    app.get("/posts/user/:email", async (req, res) => {
      try {
        const posts = await postCollection
          .find({ authorEmail: req.params.email })
          .toArray();
        res.json(posts);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Delete a post by ID
    app.delete("/posts/:id", async (req, res) => {
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

    // ✅ Get user profile by email
    app.get("/users/:email", async (req, res) => {
      try {
        const user = await userCollection.findOne({
          email: req.params.email,
        });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.send(user);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Get 3 recent posts by a user
    app.get("/posts/recent/:email", async (req, res) => {
      try {
        const posts = await postCollection
          .find({ authorEmail: req.params.email })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();
        res.send(posts);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Test MongoDB connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. MongoDB is connected.");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}
run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Forum website is running on port ${port}`);
});
