import { NextResponse } from 'next/server';

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data } as ApiResponse<T>,
    { status }
  );
}

export function errorResponse(error: string, status = 500) {
  return NextResponse.json(
    { success: false, error } as ApiResponse,
    { status }
  );
}