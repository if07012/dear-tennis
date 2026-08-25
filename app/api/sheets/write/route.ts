import { NextResponse } from 'next/server';
import { appendSheetData } from '../../../../app/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { spreadsheetId, data, sheetIndex, sheetName } = await request.json();

    if (!spreadsheetId || !data) {
      return NextResponse.json(
        { error: 'spreadsheetId and data are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: 'data must be an array of objects' },
        { status: 400 }
      );
    }

    const result = await appendSheetData(
      spreadsheetId,
      data,
      sheetName ?? (sheetIndex !== undefined ? sheetIndex : 0)
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/sheets/write:', error);
    return NextResponse.json(
      { error: 'Failed to write to Google Sheet' },
      { status: 500 }
    );
  }
} 