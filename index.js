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
        user.membership = "normal";
        user.badge = "Bronze";
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
            {
              $project: {
                comments: 0, // don’t send whole comment array
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

    // ✅ Sort posts by popularity (upVote - downVote) with comment count
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
            {
              $project: {
                comments: 0,
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

    // ✅ Get post count for a user
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

    // ✅ Get post details by ID with comments
    app.get("/posts/:id", async (req, res) => {
      try {
        const postId = req.params.id;
        const post = await postCollection
          .aggregate([
            { $match: { _id: new ObjectId(postId) } },
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
          ])
          .toArray();

        if (!post[0]) return res.status(404).json({ message: "Post not found" });
        res.json(post[0]);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Add comment to a specific post
    app.post("/posts/:id/comments", async (req, res) => {
      try {
        const postId = req.params.id;
        const { authorEmail, commentText ,authorImage} = req.body;

        const comment = {
          postId: new ObjectId(postId), // make sure it's ObjectId
          authorEmail,
          commentText,
          authorImage: authorImage || user?.photo || null, 
          createdAt: new Date(),
        };

        const result = await commentCollection.insertOne(comment);
        res.json({ message: "Comment added", comment: result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ✅ Upvote a post
    app.post("/posts/:id/upvote", async (req, res) => {
      try {
        const postId = req.params.id;
        await postCollection.updateOne(
          { _id: new ObjectId(postId) },
          { $inc: { upVote: 1 } }
        );
        res.json({ message: "Post upvoted" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    // ✅ Downvote a post
    app.post("/posts/:id/downvote", async (req, res) => {
      try {
        const postId = req.params.id;
        await postCollection.updateOne(
          { _id: new ObjectId(postId) },
          { $inc: { downVote: 1 } }
        );
        res.json({ message: "Post downvoted" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  // ✅ Update a comment
app.put("/comments/:id", async (req, res) => {
  try {
    const commentId = req.params.id;
    const { commentText, userEmail } = req.body; // get logged-in user's email from frontend

    const comment = await commentCollection.findOne({ _id: new ObjectId(commentId) });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Only comment owner can edit
    if (comment.authorEmail !== userEmail) {
      return res.status(403).json({ message: "Not allowed to edit this comment" });
    }

    await commentCollection.updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { commentText, updatedAt: new Date() } }
    );

    res.json({ message: "Comment updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete a comment
app.delete("/comments/:id", async (req, res) => {
  try {
    const commentId = req.params.id;
    const { userEmail } = req.body; // frontend must send logged-in user's email

    const comment = await commentCollection.findOne({ _id: new ObjectId(commentId) });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const post = await postCollection.findOne({ _id: new ObjectId(comment.postId) });
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Permission check: comment owner OR post owner
    if (comment.authorEmail !== userEmail && post.authorEmail !== userEmail) {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await commentCollection.deleteOne({ _id: new ObjectId(commentId) });
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Example in your Express server
app.put("/users/membership/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const { membership } = req.body;

    let badge = "Normal";
    if (membership === "premium" || membership === "gold") {
      badge = "Gold";
    }

    const result = await userCollection.updateOne(
      { email },
      { $set: { membership ,badge} }
    );

    if (result.modifiedCount === 0) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Membership updated successfully" });
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
