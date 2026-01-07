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
            // Ticket 1: Y=10
            this.drawTicket(doc, topTicket, config, 10, 10);

            if (bottomTicket) {
                // Cut line at ~148mm
                doc.setDrawColor(200);
                doc.line(10, 148, 200, 148);

                // Ticket 2: Y=158 (leaving 10mm padding from cut line)
                this.drawTicket(doc, bottomTicket, config, 10, 158);
            }
        }

        doc.save('bingo-tickets.pdf');
    }

    private static drawTicket(doc: any, ticket: BingoTicket, config: PDFConfig, _x: number, y: number) {
        // A4 dimensions and margins
        const pageWidth = 210; // A4 width in mm
        const leftMargin = 10;
        const rightMargin = 10;
        const contentWidth = pageWidth - leftMargin - rightMargin;

        // Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(config.headerText, pageWidth / 2, y + 10, { align: "center" });

        // Grid - calculate dimensions for uniform spacing
        const body = ticket.grid.map(row =>
            row.map(cell => `${cell.song.artist}\n${cell.song.title}`)
        );

        const gridSize = ticket.grid.length; // 3, 4, or 5
        const cellHeight = 16; // Fixed height for uniform vertical spacing
        const tableWidth = contentWidth - 10; // Leave small padding from edges
        const columnWidth = tableWidth / gridSize; // Uniform column width

        // Create columnStyles object with uniform widths for all columns
        const columnStyles: any = {};
        for (let i = 0; i < gridSize; i++) {
            columnStyles[i] = { cellWidth: columnWidth };
        }

        const tableResult = autoTable(doc, {
            startY: y + 15,
            margin: { left: leftMargin + 5, right: rightMargin + 5 },
            body: body,
            theme: 'grid',
            tableWidth: tableWidth,
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

        // Get the final Y position after table (from autoTable result)
        //@ts-ignore
        const tableEndY = doc.lastAutoTable.finalY || (y + 15 + (gridSize * cellHeight));
        const footerY = tableEndY + 8; // Small gap after table

        // Footer
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(config.footerText, pageWidth / 2, footerY, { align: "center" });

        // Ticket Number Circle (Left Side)
        const circleX = 25;
        const circleY = footerY;
        const radius = 8;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.circle(circleX, circleY, radius, 'S');

        doc.setFontSize(14); // Larger font
        doc.setFont("helvetica", "bold");
        // Using common hack for vertical alignment since baseline support varies
        doc.text(ticket.id, circleX, circleY + 1.5, { align: "center" });

        // Logo - Anchored to bottom-right of non-margin space
        if (config.logoUrl) {
            try {
                const logoWidth = 20;
                const logoHeight = 20;
                const ticketBottomY = footerY + 5; // Bottom of ticket area
                const ticketRightX = pageWidth - rightMargin;

                // Position logo so its bottom-right corner aligns with ticket's bottom-right
                // jsPDF addImage uses top-left corner, so we subtract dimensions
                const logoX = ticketRightX - logoWidth;
                const logoY = ticketBottomY - logoHeight;

                doc.addImage(config.logoUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
            } catch (e) {
                console.warn("Failed to add logo", e);
            }
        }
    }
}
