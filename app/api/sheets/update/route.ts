import { NextResponse } from 'next/server';
import { updateSheetData } from '../../../../app/lib/googleSheets';

export async function PUT(request: Request) {
  try {
    const { spreadsheetId, rowIndex, data, sheetIndex } = await request.json();

    if (!spreadsheetId || rowIndex === undefined || !data) {
      return NextResponse.json(
        { error: 'spreadsheetId, rowIndex, and data are required' },
        { status: 400 }
      );
    }

    const result = await updateSheetData(
      spreadsheetId,
      rowIndex,
      data,
      sheetIndex || 0
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in PUT /api/sheets/update:', error);
    return NextResponse.json(
      { error: 'Failed to update Google Sheet' },
      { status: 500 }
    );
  }
} 