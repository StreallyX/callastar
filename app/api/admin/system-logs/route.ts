import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { getSystemLogs, deleteLogsByDateRange, deleteLogsByFilters } from '@/lib/system-logger';
import { LogLevel, LogActor } from '@prisma/client';

// Schema validation for query parameters (GET)
const logsQuerySchema = z.object({
  level: z.nativeEnum(LogLevel).optional(),
  type: z.string().optional(),
  actor: z.nativeEnum(LogActor).optional(),
  actorId: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  search: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 100),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  orderBy: z.enum(['asc', 'desc']).optional(),
});

// Schema validation for delete request (DELETE)
const deleteLogsSchema = z.object({
  deleteType: z.enum(['dateRange', 'filters']),
  startDate: z.string().optional(), // ISO date string (required for dateRange)
  endDate: z.string().optional(), // ISO date string (required for dateRange)
  level: z.nativeEnum(LogLevel).optional(),
  type: z.string().optional(),
  actor: z.nativeEnum(LogActor).optional(),
  actorId: z.string().optional(),
});

/**
 * GET /api/admin/system-logs
 * Fetch system logs with filtering and pagination
 * 
 * Query Parameters:
 * - level: Filter by log level (INFO, WARNING, ERROR, CRITICAL)
 * - type: Filter by log type (partial match, case-insensitive)
 * - actor: Filter by actor (USER, CREATOR, ADMIN, SYSTEM, GUEST)
 * - actorId: Filter by specific actor ID
 * - startDate: Filter logs from this date (ISO string)
 * - endDate: Filter logs until this date (ISO string)
 * - search: Search in message, type, and actorId (case-insensitive)
 * - limit: Number of logs to return (default: 100, max: 500)
 * - offset: Number of logs to skip for pagination (default: 0)
 * - page: Page number (alternative to offset)
 * - orderBy: Sort order by createdAt ('asc' or 'desc', default: 'desc')
 * 
 * Example: /api/admin/system-logs?level=ERROR&actor=USER&page=1&limit=100
 * 
 * @returns Paginated system logs with metadata
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false,
        error: 'Non authentifié' 
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Accès réservé aux administrateurs' 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      level: searchParams.get('level') || undefined,
      type: searchParams.get('type') || undefined,
      actor: searchParams.get('actor') || undefined,
      actorId: searchParams.get('actorId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      page: searchParams.get('page') || undefined,
      orderBy: searchParams.get('orderBy') || undefined,
    };

    // Validate query parameters
    const validatedParams = logsQuerySchema.parse(queryParams);

    // Apply limit cap
    const limit = Math.min(validatedParams.limit || 100, 500);

    // Calculate offset from page number if provided
    let offset = validatedParams.offset || 0;
    if (validatedParams.page && validatedParams.page > 1) {
      offset = (validatedParams.page - 1) * limit;
    }

    // Fetch logs with filters
    const filters = {
      level: validatedParams.level,
      type: validatedParams.type,
      actor: validatedParams.actor,
      actorId: validatedParams.actorId,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      search: validatedParams.search,
      limit,
      offset,
      orderBy: validatedParams.orderBy || 'desc',
    };

    const result = await getSystemLogs(filters);

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      success: true,
      logs: result.logs,
      pagination: {
        totalCount: result.total,
        totalPages,
        currentPage,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres de requête invalides',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des logs',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/system-logs
 * Delete system logs by date range or filters
 * 
 * Request Body:
 * {
 *   "deleteType": "dateRange" | "filters",
 *   "startDate": "2024-01-01T00:00:00Z", // Required for dateRange
 *   "endDate": "2024-12-31T23:59:59Z", // Required for dateRange
 *   "level": "INFO" | "WARNING" | "ERROR" | "CRITICAL", // Optional filter
 *   "type": "USER_LOGIN", // Optional filter
 *   "actor": "USER" | "CREATOR" | "ADMIN" | "SYSTEM", // Optional filter
 *   "actorId": "user-id" // Optional filter
 * }
 * 
 * @returns Number of logs deleted
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false,
        error: 'Non authentifié' 
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Accès réservé aux administrateurs' 
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = deleteLogsSchema.parse(body);

    let deletedCount = 0;

    if (validatedData.deleteType === 'dateRange') {
      // Delete by date range
      if (!validatedData.startDate || !validatedData.endDate) {
        return NextResponse.json(
          {
            success: false,
            error: 'startDate et endDate sont requis pour deleteType=dateRange',
          },
          { status: 400 }
        );
      }

      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);

      deletedCount = await deleteLogsByDateRange(
        startDate,
        endDate,
        validatedData.level
      );
    } else {
      // Delete by filters
      const filters = {
        level: validatedData.level,
        type: validatedData.type,
        actor: validatedData.actor,
        actorId: validatedData.actorId,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      };

      deletedCount = await deleteLogsByFilters(filters);
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `${deletedCount} log(s) supprimé(s) avec succès`,
    });
  } catch (error) {
    console.error('Error deleting system logs:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Données de requête invalides',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la suppression des logs',
      },
      { status: 500 }
    );
  }
}
