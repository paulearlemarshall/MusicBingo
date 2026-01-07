import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BingoTicket } from './BingoLogic';

export interface PDFConfig {
    headerText: string;
    footerText: string;
    logoUrl?: string; // Data URL or Image URL
}

export class PDFGenerator {

    /**
     * Truncates text to fit within a specified maximum width, adding an ellipsis if truncated.
     * Requires setting the font size on the doc object before calling.
     */
    private static truncateText(text: string, maxWidth: number, doc: jsPDF, fontSize: number): string {
        doc.setFontSize(fontSize); 
        let textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
        if (textWidth <= maxWidth) {
            return text;
        }

        let truncated = text;
        const ellipsisWidth = doc.getStringUnitWidth('...') * fontSize / doc.internal.scaleFactor;
        while (textWidth > maxWidth - ellipsisWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
            textWidth = doc.getStringUnitWidth(truncated) * fontSize / doc.internal.scaleFactor;
        }
        return truncated + '...';
    }

    static generateTicketsPDF(tickets: BingoTicket[], config: PDFConfig) {
        const doc = new jsPDF();
        const ticketsArray = tickets.slice(); // Copy to array

        // Process tickets in pairs (2 per page)
        for (let i = 0; i < ticketsArray.length; i += 2) {
            if (i > 0) doc.addPage();

            const topTicket = ticketsArray[i];
            const bottomTicket = ticketsArray[i + 1];

            // A4 Height = 297mm. Half = 148.5mm.
            // Top ticket: halfStartY = 0
            this.drawTicket(doc, topTicket, config, 0);

            if (bottomTicket) {
                // Cut line at exactly 148.5mm (page midpoint)
                doc.setDrawColor(200);
                doc.setLineDash([5, 3]); // Dashed line for cutting guide
                doc.line(0, 148.5, 210, 148.5);
                doc.setLineDash([]); // Reset to solid line

                // Bottom ticket: halfStartY = 148.5
                this.drawTicket(doc, bottomTicket, config, 148.5);
            }
        }

        doc.save('bingo-tickets.pdf');
    }

    private static drawTicket(doc: any, ticket: BingoTicket, config: PDFConfig, halfStartY: number) {
        // A4 dimensions and constants
        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const halfHeight = 148.5; // Half page height
        const leftMargin = 10;
        const rightMargin = 10;

        // Header - Fixed at top of half
        const headerY = halfStartY + 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(config.headerText, pageWidth / 2, headerY, { align: "center" });

        // Footer - Fixed at bottom of half
        const footerY = halfStartY + halfHeight - 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(config.footerText, pageWidth / 2, footerY, { align: "center" });

        // Grid dimensions - Fixed width, variable height based on grid size
        const gridSize = ticket.grid.length; // 3, 4, or 5
        const cellHeight = 16; // Fixed height for uniform vertical spacing
        const gridWidth = 160; // Fixed width for all grid sizes
        const gridHeight = gridSize * cellHeight;
        const columnWidth = gridWidth / gridSize; // Uniform column width

        // Center grid vertically between header and footer
        const verticalSpace = footerY - headerY - 10; // Available space minus padding
        const gridStartY = headerY + 5 + (verticalSpace - gridHeight) / 2;

        // Center grid horizontally
        const gridStartX = (pageWidth - gridWidth) / 2; // = (210 - 160) / 2 = 25mm

        // Prepare grid data
        const body = ticket.grid.map(row =>
            row.map(cell => `${cell.song.artist}\n${cell.song.title}`)
        );

        // Create columnStyles object with uniform widths for all columns
        const columnStyles: any = {};
        for (let i = 0; i < gridSize; i++) {
            columnStyles[i] = { cellWidth: columnWidth };
        }

        // Draw grid using autoTable with precise positioning
        autoTable(doc, {
            startY: gridStartY,
            margin: { left: gridStartX, right: gridStartX },
            body: body,
            theme: 'grid',
            tableWidth: gridWidth,
            columnStyles: columnStyles,
            styles: {
                fontSize: 9,
                cellPadding: 2,
                valign: 'middle',
                halign: 'center',
                minCellHeight: cellHeight, // Uniform height
                cellWidth: 'wrap'
            },
            pageBreak: 'avoid',
            rowPageBreak: 'avoid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontSize: 10
            },
            // Use willDrawCell to customize text Rendering
            willDrawCell: (data) => {
                if (data.section === 'body') {
                    // Suppress default drawing
                    //@ts-ignore
                    data.cell.text = [];
                }
            },
            didDrawCell: (data) => {
                if (data.section === 'body') {
                    const cell = data.cell;
                    //@ts-ignore
                    const rawText = cell.raw as string;
                    if (!rawText) return;

                    const parts = rawText.split('\n');
                    let artist = parts[0];
                    let title = parts[1];

                    const x = cell.x + cell.width / 2;
                    const yCenter = cell.y + cell.height / 2;
                    const padding = 4; // space from cell edges

                    // Artist - Normal
                    const artistFontSize = 7;
                    doc.setFont("helvetica", "normal");
                    artist = PDFGenerator.truncateText(artist, cell.width - padding, doc, artistFontSize);
                    doc.setFontSize(artistFontSize);
                    doc.setTextColor(100);
                    doc.text(artist, x, yCenter - 1, { align: 'center' });

                    // Title - Bold
                    const titleFontSize = 9;
                    doc.setFont("helvetica", "bold");
                    title = PDFGenerator.truncateText(title, cell.width - padding, doc, titleFontSize);
                    doc.setFontSize(titleFontSize);
                    doc.setTextColor(0);
                    doc.text(title, x, yCenter + 3, { align: 'center' });
                }
            }
        });

        // Ticket Number Circle - Bottom-left, aligned with footer
        const circleX = 20;
        const circleY = footerY;
        const radius = 8;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.circle(circleX, circleY, radius, 'S');

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(ticket.id, circleX, circleY + 1.5, { align: "center" });

        // Logo - Bottom-right corner of half
        if (config.logoUrl) {
            try {
                const logoWidth = 20;
                const logoHeight = 20;

                // Position logo so its bottom-right corner aligns with half's bottom-right
                // jsPDF addImage uses top-left corner, so we subtract dimensions
                const logoX = pageWidth - rightMargin - logoWidth;
                const logoY = halfStartY + halfHeight - rightMargin - logoHeight;

                doc.addImage(config.logoUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
            } catch (e) {
                console.warn("Failed to add logo", e);
            }
        }
    }
}
