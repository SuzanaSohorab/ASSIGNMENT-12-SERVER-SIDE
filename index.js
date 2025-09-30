require('dotenv').config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const app = express()
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000
// Middleware
app.use(
	cors({
		origin: ['http://localhost:5173', 'https://forum-7a00d.web.app'],
		credentials: true,
	}),
)
app.use(express.json())
app.use(cookieParser())

//verify token
const verifyJWT = (req, res, next) => {
	const token = req.cookies?.token

	if (!token) {
		return res.status(401).json({ message: 'Unauthorized' })
	}

	jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
		if (err) {
			return res.status(403).json({ message: 'Forbidden' })
		}
		req.user = decoded
		next()
	})
}

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.joiywm2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// "mongodb+srv://forumDB:XnSo18x87U52j8HG@cluster0.joiywm2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
})

async function run() {
	try {
		// await client.connect();
		const userCollection = client.db('forumDB').collection('users')
		const postCollection = client.db('forumDB').collection('posts')
		const commentCollection = client.db('forumDB').collection('comments')
		const announcementCollection = client
			.db('forumDB')
			.collection('announcements')

		// ✅ Create a new user
		app.post('/users', async (req, res) => {
			try {
				const user = req.body
				user.role = 'user'
				user.membership = 'normal'
				user.badge = 'Bronze'
				const result = await userCollection.insertOne(user)
				res.send(result)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		//jwt api
		app.post('/jwt', async (req, res) => {
			const { email } = req.body
			const user = { email }
			const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
				expiresIn: '1d',
			})
			//set cookie
			res.cookie('token', token, {
				httpOnly: true,
				 secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
			})

			res.send({ success: true })
		})

		app.get('/posts/secure', verifyJWT, async (req, res) => {
			res.send({
				message: `Hello ${req.user.email}, this is a protected route!`,
			})
		})

		// ✅ Create a new post
		app.post('/posts', async (req, res) => {
			try {
				const { authorEmail, ...rest } = req.body

				const user = await userCollection.findOne({ email: authorEmail })

				const post = {
					...rest,
					authorEmail,
					authorImage: user?.photo || rest.authorImage || null,
					createdAt: new Date(),
					upVote: 0,
					downVote: 0,
				}

				const result = await postCollection.insertOne(post)
				res.send(result)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get all posts (newest first, with pagination + comment count)
		app.get('/posts', async (req, res) => {
			try {
				const page = parseInt(req.query.page) || 1
				const limit = parseInt(req.query.limit) || 5
				const skip = (page - 1) * limit

				const posts = await postCollection
					.aggregate([
						{
							$lookup: {
								from: 'comments',
								localField: '_id',
								foreignField: 'postId',
								as: 'comments',
							},
						},
						{
							$addFields: {
								commentCount: { $size: '$comments' },
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
					.toArray()

				const totalPosts = await postCollection.countDocuments()
				res.json({
					posts,
					totalPages: Math.ceil(totalPosts / limit),
					currentPage: page,
				})
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Sort posts by popularity (upVote - downVote) with comment count
		app.get('/posts/popular', async (req, res) => {
			try {
				const page = parseInt(req.query.page) || 1
				const limit = parseInt(req.query.limit) || 5
				const skip = (page - 1) * limit

				const posts = await postCollection
					.aggregate([
						{
							$lookup: {
								from: 'comments',
								localField: '_id',
								foreignField: 'postId',
								as: 'comments',
							},
						},
						{
							$addFields: {
								commentCount: { $size: '$comments' },
								voteDifference: { $subtract: ['$upVote', '$downVote'] },
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
					.toArray()

				const totalPosts = await postCollection.countDocuments()
				res.json({
					posts,
					totalPages: Math.ceil(totalPosts / limit),
					currentPage: page,
				})
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get post count for a user
		// Get comments for a post
		app.get('/comments/:postId', async (req, res) => {
			try {
				const postId = req.params.postId
				const comments = await commentCollection
					.find({ postId: new ObjectId(postId) }) // ✅ fix: convert to ObjectId
					.toArray()
				res.send(comments)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Add a comment to a post
		app.post('/comments', async (req, res) => {
			try {
				const comment = {
					...req.body,
					createdAt: new Date(),
				}
				const result = await commentCollection.insertOne(comment)
				res.send(result)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// // ✅ Get comments for a post
		// app.get("/comments/:postId", async (req, res) => {
		//   try {
		//     const postId = req.params.postId;
		//     const comments = await commentCollection
		//       .find({ postId })
		//       .toArray();
		//     res.send(comments);
		//   } catch (err) {
		//     res.status(500).json({ error: err.message });
		//   }
		// });

		// ✅ Get all posts by a user
		app.get('/posts/user/:email', async (req, res) => {
			try {
				const posts = await postCollection
					.find({ authorEmail: req.params.email })
					.toArray()
				res.json(posts)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Delete a post by ID
		app.delete('/posts/:id', async (req, res) => {
			try {
				const result = await postCollection.deleteOne({
					_id: new ObjectId(req.params.id),
				})
				if (result.deletedCount === 0)
					return res.status(404).json({ message: 'Post not found' })
				res.json({ message: 'Post deleted successfully' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get user profile by email
		app.get('/users/:email', async (req, res) => {
			try {
				const user = await userCollection.findOne({
					email: req.params.email,
				})
				if (!user) return res.status(404).json({ message: 'User not found' })
				res.send(user)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get 3 recent posts by a user
		app.get('/posts/recent/:email', async (req, res) => {
			try {
				const posts = await postCollection
					.find({ authorEmail: req.params.email })
					.sort({ createdAt: -1 })
					.limit(3)
					.toArray()
				res.send(posts)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get post details by ID with comments
		app.get('/posts/:id', async (req, res) => {
			try {
				const postId = req.params.id
				const post = await postCollection
					.aggregate([
						{ $match: { _id: new ObjectId(postId) } },
						{
							$lookup: {
								from: 'comments',
								localField: '_id',
								foreignField: 'postId',
								as: 'comments',
							},
						},
						{
							$addFields: {
								commentCount: { $size: '$comments' },
							},
						},
					])
					.toArray()

				if (!post[0]) return res.status(404).json({ message: 'Post not found' })
				res.json(post[0])
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Add comment to a specific post
		app.post('/posts/:id/comments', async (req, res) => {
			try {
				const postId = req.params.id
				const { authorEmail, commentText, authorImage } = req.body

				const comment = {
					postId: new ObjectId(postId), // make sure it's ObjectId
					authorEmail,
					commentText,
					authorImage: authorImage || user?.photo || null,
					createdAt: new Date(),
				}

				const result = await commentCollection.insertOne(comment)
				res.json({ message: 'Comment added', comment: result })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Upvote a post
		app.post('/posts/:id/upvote', async (req, res) => {
			try {
				const postId = req.params.id
				await postCollection.updateOne(
					{ _id: new ObjectId(postId) },
					{ $inc: { upVote: 1 } },
				)
				res.json({ message: 'Post upvoted' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		// ✅ Downvote a post
		app.post('/posts/:id/downvote', async (req, res) => {
			try {
				const postId = req.params.id
				await postCollection.updateOne(
					{ _id: new ObjectId(postId) },
					{ $inc: { downVote: 1 } },
				)
				res.json({ message: 'Post downvoted' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		// ✅ Update a comment
		app.put('/comments/:id', async (req, res) => {
			try {
				const commentId = req.params.id
				const { commentText, userEmail } = req.body // get logged-in user's email from frontend

				const comment = await commentCollection.findOne({
					_id: new ObjectId(commentId),
				})
				if (!comment)
					return res.status(404).json({ message: 'Comment not found' })

				// Only comment owner can edit
				if (comment.authorEmail !== userEmail) {
					return res
						.status(403)
						.json({ message: 'Not allowed to edit this comment' })
				}

				await commentCollection.updateOne(
					{ _id: new ObjectId(commentId) },
					{ $set: { commentText, updatedAt: new Date() } },
				)

				res.json({ message: 'Comment updated successfully' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Delete a comment
		app.delete('/comments/:id', async (req, res) => {
			try {
				const commentId = req.params.id
				const { userEmail } = req.body // frontend must send logged-in user's email

				const comment = await commentCollection.findOne({
					_id: new ObjectId(commentId),
				})
				if (!comment)
					return res.status(404).json({ message: 'Comment not found' })

				const post = await postCollection.findOne({
					_id: new ObjectId(comment.postId),
				})
				if (!post) return res.status(404).json({ message: 'Post not found' })

				// Permission check: comment owner OR post owner
				if (
					comment.authorEmail !== userEmail &&
					post.authorEmail !== userEmail
				) {
					return res
						.status(403)
						.json({ message: 'Not allowed to delete this comment' })
				}

				await commentCollection.deleteOne({ _id: new ObjectId(commentId) })
				res.json({ message: 'Comment deleted successfully' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		// Example in your Express server
		app.put('/users/membership/:email', async (req, res) => {
			try {
				const email = req.params.email
				const { membership } = req.body

				let badge = 'Normal'
				if (membership === 'premium' || membership === 'gold') {
					badge = 'Gold'
				}

				const result = await userCollection.updateOne(
					{ email },
					{ $set: { membership, badge } },
				)

				if (result.modifiedCount === 0)
					return res.status(404).json({ message: 'User not found' })

				res.json({ message: 'Membership updated successfully' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		// ✅ Search posts by tag (place BEFORE /posts/:id)
		app.get('/posts/search/keyword', async (req, res) => {
			try {
				const keyword = req.query.keyword
				console.log('Search keyword:', keyword)
				if (!keyword) return res.json([])

				const posts = await postCollection
					.find({
						tag: { $regex: new RegExp(keyword.trim(), 'i') },
					})
					.toArray()

				res.json(posts)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get post details by ID (must be after search)
		app.get('/posts/:id', async (req, res) => {
			try {
				const postId = req.params.id
				const post = await postCollection
					.aggregate([
						{ $match: { _id: new ObjectId(postId) } },
						{
							$lookup: {
								from: 'comments',
								localField: '_id',
								foreignField: 'postId',
								as: 'comments',
							},
						},
						{ $addFields: { commentCount: { $size: '$comments' } } },
					])
					.toArray()

				if (!post[0]) return res.status(404).json({ message: 'Post not found' })
				res.json(post[0])
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get all users
		app.get('/users', async (req, res) => {
			try {
				const users = await userCollection.find().toArray()
				res.json(users)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Make user admin
		// ✅ Toggle user role (admin <-> user)
		app.put('/users/toggle-role/:id', async (req, res) => {
			try {
				const id = req.params.id

				const user = await userCollection.findOne({ _id: new ObjectId(id) })
				if (!user) return res.status(404).json({ message: 'User not found' })

				const newRole = user.role === 'admin' ? 'user' : 'admin'

				await userCollection.updateOne(
					{ _id: new ObjectId(id) },
					{ $set: { role: newRole } },
				)

				res.json({ message: `Role updated to ${newRole}`, role: newRole })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})
		app.get('/admin/:email', async (req, res) => {
			try {
				const admin = await userCollection.findOne({ email: req.params.email })
				if (!admin) return res.status(404).json({ message: 'Admin not found' })
				res.json(admin)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// Report a comment

		// Report a comment (store post title as well)
		// Report a comment (store post title and reporter name)
		app.post('/reports', async (req, res) => {
			try {
				const { commentId, reporterEmail, feedback } = req.body

				// Fetch the comment
				const comment = await commentCollection.findOne({
					_id: new ObjectId(commentId),
				})
				if (!comment)
					return res.status(404).json({ message: 'Comment not found' })

				// Fetch the post for this comment
				const post = await postCollection.findOne({
					_id: new ObjectId(comment.postId),
				})
				if (!post) return res.status(404).json({ message: 'Post not found' })

				// Fetch reporter's name
				const reporterUser = await userCollection.findOne({
					email: reporterEmail,
				})

				// Create report object
				const report = {
					commentId,
					postId: comment.postId,
					postTitle: post.title || 'No title',
					reporterEmail,
					reporterName: reporterUser?.name || 'Unknown',
					reason: feedback || 'No reason provided',
					commentText: comment.commentText || comment.text,
					commenterEmail: comment.authorEmail || comment.email,
					createdAt: new Date(),
					status: 'pending',
				}

				// Insert into reports collection
				const result = await client
					.db('forumDB')
					.collection('reports')
					.insertOne(report)
				res.status(201).json({ message: 'Report submitted', report: report })
			} catch (err) {
				console.error(err)
				res.status(500).json({ error: err.message })
			}
		})

		// Get all reports (for Admin)
		// Get all reports (for Admin)
		app.get('/reports', async (req, res) => {
			try {
				const reports = await client
					.db('forumDB')
					.collection('reports')
					.aggregate([
						{
							$lookup: {
								from: 'posts',
								localField: 'postId',
								foreignField: '_id',
								as: 'post',
							},
						},
						{
							$unwind: {
								path: '$post',
								preserveNullAndEmptyArrays: true,
							},
						},
						{
							$project: {
								reporterEmail: 1,
								reporterName: 1,
								reason: 1,
								commentText: 1,
								commenterEmail: 1,
								commentId: 1,
								postId: 1,
								postTitle: { $ifNull: ['$post.title', '$postTitle'] }, // fallback to stored title
							},
						},
					])
					.toArray()

				res.send(reports)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Get all announcements (newest first)
		app.get('/announcements', async (req, res) => {
			try {
				const announcements = await announcementCollection
					.find()
					.sort({ createdAt: -1 })
					.toArray()
				res.json(announcements)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Create a new announcement (admin only)
		app.post('/announcements', async (req, res) => {
			try {
				const { title, description, authorName, authorEmail, authorImage } =
					req.body
				if (!title || !description || !authorName || !authorEmail) {
					return res.status(400).json({ message: 'All fields are required' })
				}

				const newAnnouncement = {
					title,
					description,
					authorName,
					authorEmail,
					authorImage,
					createdAt: new Date(),
				}

				const result = await announcementCollection.insertOne(newAnnouncement)
				res.status(201).json(result)
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Delete an announcement (admin only)
		app.delete('/announcements/:id', async (req, res) => {
			try {
				const id = req.params.id
				const result = await announcementCollection.deleteOne({
					_id: new ObjectId(id),
				})
				if (result.deletedCount === 0)
					return res.status(404).json({ message: 'Announcement not found' })
				res.json({ message: 'Announcement deleted successfully' })
			} catch (err) {
				res.status(500).json({ error: err.message })
			}
		})

		// ✅ Test MongoDB connection
		// await client.db("admin").command({ ping: 1 });
		// console.log("Pinged your deployment. MongoDB is connected.");
	} catch (err) {
		console.error('Error connecting to MongoDB:', err)
	}
}
run().catch(console.dir)

app.get('/', (req, res) => {
	res.send('Simple forum website is running')
})

// Start server
app.listen(port, () => {
	console.log(`Forum website is running on port ${port}`)
})
