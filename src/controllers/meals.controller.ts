import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import * as mealsServices from "../services/meals.service.js";
import { getPaginationParams, paginate } from "../utils/pagination.js";

export const getAllMeals = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = getPaginationParams(req);

    const allMeals = await mealsServices.getAllMeals();
    const { data, pagination } = paginate(allMeals, page, limit);

    res.status(200).json({
        success: true,
        data,
        pagination,
    });
});

export const getMealById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const mealId = String(id)

    const meal = await mealsServices.getMealById(mealId);

    if (!meal) {
        res.status(404).json({
            success: false,
            message: "Meal not found",
        });
        return;
    }

    // No pagination here — it's a single meal.
    res.status(200).json({
        success: true,
        data: meal,
    });
});

export const searchMeal = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    const { page, limit } = getPaginationParams(req);

    if (!q) {
        res.status(400).json({
            success: false,
            message: "Search query 'q' is required, e.g. /api/meals/search?q=chicken",
        });
        return;
    }

    const meals = await mealsServices.searchMeal(q as string);
    const { data, pagination } = paginate(meals, page, limit);

    res.status(200).json({
        success: true,
        data,
        pagination,
    });
});

export const getAllCat = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = getPaginationParams(req);

    const categories = await mealsServices.getAllCat();
    const { data, pagination } = paginate(categories, page, limit);

    res.status(200).json({
        success: true,
        data,
        pagination,
    });
});

export const getMealbyCat = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;
    const cat = String(category)
    const { page, limit } = getPaginationParams(req);

    const meals = await mealsServices.getMealByCat(cat);
    const { data, pagination } = paginate(meals, page, limit);

    res.status(200).json({
        success: true,
        data,
        pagination,
    });
});