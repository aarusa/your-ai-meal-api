# Meal API Documentation

This document describes the comprehensive meal API endpoints for managing AI-generated meals in the YAM (Your AI Meals) application.

## Base URL
```
http://localhost:3000/api/meals
```

## Authentication
All endpoints require a `userId` query parameter to identify the user.

---

## Endpoints

### 1. Get User Meals
**GET** `/api/meals`

Fetch all meals for a user with optional filtering, sorting, and pagination.

**Query Parameters:**
- `userId` (required): User ID
- `status` (optional): Filter by meal status (`generated`, `accepted`, `rejected`, `cooked`)
- `mealType` (optional): Filter by meal type (`breakfast`, `lunch`, `dinner`, `snack`)
- `limit` (optional): Number of meals to return (default: 50)
- `offset` (optional): Number of meals to skip (default: 0)
- `sortBy` (optional): Field to sort by (default: `created_at`)
- `sortOrder` (optional): Sort order (`asc` or `desc`, default: `desc`)

**Example Request:**
```
GET /api/meals?userId=123&status=accepted&limit=10&offset=0
```

**Response:**
```json
{
  "meals": [
    {
      "id": "meal-uuid",
      "user_id": "123",
      "name": "Chicken Stir Fry",
      "description": "A quick and healthy chicken stir fry",
      "meal_type": "dinner",
      "total_calories": 450,
      "total_protein": 35,
      "total_carbs": 25,
      "total_fats": 20,
      "prep_time_minutes": 10,
      "cook_time_minutes": 15,
      "total_time_minutes": 25,
      "difficulty_level": "easy",
      "servings": 2,
      "status": "accepted",
      "is_favorited": false,
      "user_rating": 4,
      "created_at": "2024-01-15T10:30:00Z",
      "meal_ingredients": [...]
    }
  ],
  "total": 25,
  "limit": 10,
  "offset": 0,
  "hasMore": true
}
```

---

### 2. Get Recent Meals
**GET** `/api/meals/recent`

Fetch recently created meals for dashboard display.

**Query Parameters:**
- `userId` (required): User ID
- `limit` (optional): Number of meals to return (default: 5)

**Example Request:**
```
GET /api/meals/recent?userId=123&limit=5
```

**Response:**
```json
[
  {
    "id": "meal-uuid",
    "name": "Recent Meal",
    "description": "A recently created meal",
    "meal_type": "breakfast",
    "total_calories": 300,
    "total_protein": 20,
    "prep_time_minutes": 5,
    "cook_time_minutes": 10,
    "difficulty_level": "easy",
    "servings": 1,
    "status": "generated",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### 3. Search Meals
**GET** `/api/meals/search`

Search meals by name or description.

**Query Parameters:**
- `userId` (required): User ID
- `query` (required): Search term
- `limit` (optional): Number of results to return (default: 20)
- `offset` (optional): Number of results to skip (default: 0)

**Example Request:**
```
GET /api/meals/search?userId=123&query=chicken&limit=10
```

**Response:**
```json
{
  "meals": [...],
  "query": "chicken",
  "total": 5
}
```

---

### 4. Get Meal Statistics
**GET** `/api/meals/stats`

Get comprehensive statistics about user's meals.

**Query Parameters:**
- `userId` (required): User ID

**Example Request:**
```
GET /api/meals/stats?userId=123
```

**Response:**
```json
{
  "totalMeals": 50,
  "acceptedMeals": 35,
  "favoriteMeals": 12,
  "recentMeals": 8,
  "acceptanceRate": "70.0"
}
```

---

### 5. Get Meal Categories
**GET** `/api/meals/categories`

Get distribution of meal types and difficulties.

**Query Parameters:**
- `userId` (required): User ID

**Example Request:**
```
GET /api/meals/categories?userId=123
```

**Response:**
```json
{
  "mealTypes": {
    "breakfast": 15,
    "lunch": 20,
    "dinner": 12,
    "snack": 3
  },
  "difficulties": {
    "easy": 25,
    "medium": 20,
    "hard": 5
  },
  "totalCategories": 4
}
```

---

### 6. Get Specific Meal
**GET** `/api/meals/:mealId`

Fetch a specific meal by ID with full details including ingredients.

**Path Parameters:**
- `mealId` (required): Meal UUID

**Example Request:**
```
GET /api/meals/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "123",
  "name": "Chicken Stir Fry",
  "description": "A quick and healthy chicken stir fry",
  "meal_type": "dinner",
  "total_calories": 450,
  "total_protein": 35,
  "total_carbs": 25,
  "total_fats": 20,
  "prep_time_minutes": 10,
  "cook_time_minutes": 15,
  "total_time_minutes": 25,
  "difficulty_level": "easy",
  "servings": 2,
  "generation_type": "pantry_based",
  "generation_criteria": {
    "ingredients": [...],
    "instructions": [...],
    "tags": [...]
  },
  "status": "accepted",
  "is_favorited": false,
  "user_rating": 4,
  "user_feedback": "Delicious and easy to make!",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "meal_ingredients": [...]
}
```

---

### 7. Update Meal Status
**PUT** `/api/meals/:mealId/status`

Update meal status, rating, or feedback.

**Path Parameters:**
- `mealId` (required): Meal UUID

**Request Body:**
```json
{
  "status": "accepted", // or "rejected", "cooked", "generated"
  "rating": 5, // optional: 1-5 star rating
  "feedback": "Amazing recipe!" // optional: user feedback
}
```

**Example Request:**
```
PUT /api/meals/123e4567-e89b-12d3-a456-426614174000/status
Content-Type: application/json

{
  "status": "accepted",
  "rating": 5,
  "feedback": "Perfect for weeknight dinners!"
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "accepted",
  "user_rating": 5,
  "user_feedback": "Perfect for weeknight dinners!",
  "is_rated": true,
  "updated_at": "2024-01-15T11:00:00Z"
}
```

---

### 8. Delete Meal
**DELETE** `/api/meals/:mealId`

Delete a meal and all associated ingredients.

**Path Parameters:**
- `mealId` (required): Meal UUID

**Example Request:**
```
DELETE /api/meals/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "message": "Meal deleted successfully"
}
```

---

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

**400 Bad Request:**
```json
{
  "error": "userId is required"
}
```

**404 Not Found:**
```json
{
  "error": "Meal not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Database connection failed"
}
```

---

## Frontend Integration

### Using the API in React Components

```typescript
import { 
  fetchUserMeals, 
  fetchMealStats, 
  searchMeals, 
  updateMealStatus 
} from '@/lib/api';

// Fetch meals with pagination
const { meals, total, hasMore } = await fetchUserMeals(userId, {
  status: 'accepted',
  limit: 10,
  offset: 0
});

// Get meal statistics
const stats = await fetchMealStats(userId);

// Search meals
const searchResults = await searchMeals(userId, 'chicken');

// Update meal status
await updateMealStatus(mealId, 'accepted', 5, 'Great recipe!');
```

---

## Database Schema

The API works with the following main tables:

- `ai_generated_meals`: Main meal records
- `meal_ingredients`: Meal ingredient relationships
- `products`: Product database
- `user_pantry_items`: User's pantry items

For detailed schema information, see the migration file:
`your-ai-meals/supabase/migrations/20241220_ai_meal_generation_system.sql`

---

## Rate Limiting

Consider implementing rate limiting for production use:
- 100 requests per minute per user for read operations
- 10 requests per minute per user for write operations

---

## Caching

For better performance, consider implementing:
- Redis caching for frequently accessed meals
- Client-side caching with React Query or SWR
- CDN caching for meal images
