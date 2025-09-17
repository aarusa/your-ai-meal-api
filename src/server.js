import express from "express"
import cors from "cors";
import userRoutes from "./routes/userRoutes.js"
import chatRoutes from "./routes/chatRoutes.js"
import productsRoutes from "./routes/productsRoutes.js"
import pantryRoutes from "./routes/pantryRoutes.js"
// import rateLimiter from "./middleware/rateLimiter.js";

const app = express()

// Enable CORS for development
app.use(cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization"
}));
app.options("*", cors());

app.use(express.json()); // to parse the request body

// Temporarily disable rate limiter during integration
// app.use(rateLimiter)
// Middleware to log the request method and url
// app.use((req, res, next) => {
//     console.log(`Request method is ${req.method} and the url is ${req.url}`);
//     next();
// });

app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/pantry", pantryRoutes);

// app.listen(3000, () => {
//     console.log("Server started on PORT: 3000");
// });

// const PORT = process.env.PORT || 3000; // use Render's PORT


const PORT = process.env.PORT; // use Render's PORT
app.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});

