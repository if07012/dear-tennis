import { NextResponse } from 'next/server';
import { readSheetData } from '../../../../app/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get('spreadsheetId');
    const sheetName = searchParams.get('sheetName');

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'spreadsheetId is required' },
        { status: 400 }
      );
    }

    const data = await readSheetData(spreadsheetId, sheetName || undefined);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/sheets/read:', error);
    return NextResponse.json(
      { error: 'Failed to read from Google Sheet' },
      { status: 500 }
    );
  }
} 