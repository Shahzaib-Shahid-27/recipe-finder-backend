import { Request } from "express";

export interface PaginationMeta {
    page: number;
    limit: number;
    totalMeals: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: PaginationMeta;
}

// Reads "page" and "limit" from the query string and makes sure
// they are valid positive numbers. Falls back to page=1, limit=10.
export const getPaginationParams = (req: Request) => {
    let page = parseInt(req.query.page as string, 10);
    let limit = parseInt(req.query.limit as string, 10);

    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = 10;

    return { page, limit };
};

// Takes the FULL array (already fetched from TheMealDB) and slices
// out only the page the client asked for.
export const paginate = <T>(items: T[], page: number, limit: number): PaginatedResult<T> => {
    const totalMeals = items.length;
    const totalPages = Math.ceil(totalMeals / limit);

    const offset = (page - 1) * limit;
    const start = offset;
    const end = offset + limit;

    // If "start" is beyond the array length, slice() safely returns []
    // instead of crashing — this covers the "page beyond available data" case.
    const data = items.slice(start, end);

    return {
        data,
        pagination: {
            page,
            limit,
            totalMeals,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
};
