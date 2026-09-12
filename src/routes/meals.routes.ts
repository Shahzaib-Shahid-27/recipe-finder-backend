import { Router } from "express";
import * as mealsController from "../controllers/meals.controller.ts";
// import { verifyJWT } from "../middlewares/auth.middleware.ts";

export const mealsRouter = Router();

// IMPORTANT: specific routes ("search", "categories", "category/:x")
// must be declared BEFORE "/:id" — otherwise Express will match
// "/search" as if "search" were an id, and it'll never reach the
// searchMeal controller.

// mealsRouter.use(verifyJWT)

// GET /api/meals/search?q=chicken&page=1&limit=10
mealsRouter.get("/search", mealsController.searchMeal);

// GET /api/meals/categories?page=1&limit=10
mealsRouter.get("/categories", mealsController.getAllCat);

// GET /api/meals/category/Seafood?page=1&limit=10
mealsRouter.get("/category/:category", mealsController.getMealbyCat);

// GET /api/meals/52772
mealsRouter.get("/:id", mealsController.getMealById);

// GET /api/meals?page=1&limit=10
mealsRouter.get("/", mealsController.getAllMeals);
