const express = require('express');
const path = require('path')
const fs = require('fs')
const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// Helper function to format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get date range based on filter type
const getDateRange = (filterType, customStartDate, customEndDate) => {
  const endDate = new Date();
  let startDate = new Date();
  
  if (filterType === 'daily') {
    startDate.setDate(endDate.getDate() - 1);
  } else if (filterType === 'weekly') {
    startDate.setDate(endDate.getDate() - 7);
  } else if (filterType === 'monthly') {
    startDate.setMonth(endDate.getMonth() - 1);
  } else if (filterType === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    return { startDate, endDate: new Date(customEndDate) };
  }
  
  return { startDate, endDate };
};

// Helper function to truncate text with ellipsis
const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// Dashboard page for sales reports
const getSalesReportDashboard = async (req, res) => {
  try {
    const filterType = req.query.filterType || 'monthly';
    const customStartDate = req.query.startDate;
    const customEndDate = req.query.endDate;
    
    const { startDate, endDate } = getDateRange(filterType, customStartDate, customEndDate);
    
    // Query orders within the date range
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate },
      status: { $nin: ['Cancelled', 'Return Denied', 'Returned'] }
    }).populate('userId', 'name email')
      .populate('orderedItems.product', 'productName salePrice');
    
    // Calculate report metrics
    const totalSales = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    
    // Calculate payment method distribution
    const paymentMethodCounts = {
      COD: 0,
      Razorpay: 0,
      Wallet: 0,
      Card: 0
    };
    
    orders.forEach(order => {
      if (paymentMethodCounts.hasOwnProperty(order.paymentMethod)) {
        paymentMethodCounts[order.paymentMethod]++;
      }
    });
    
    // Get daily sales data for chart
    const dailySales = {};
    orders.forEach(order => {
      const date = order.createdOn.toISOString().split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = {
          count: 0,
          amount: 0
        };
      }
      dailySales[date].count++;
      dailySales[date].amount += order.finalAmount;
    });
    
    // Convert to array for chart data
    const salesChartData = Object.keys(dailySales).map(date => ({
      date,
      count: dailySales[date].count,
      amount: dailySales[date].amount
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.render('admin/sales-report', {
      orders,
      totalSales,
      totalOrderAmount,
      totalDiscounts,
      totalFinalAmount,
      paymentMethodCounts,
      salesChartData,
      filterType: req.query.filterType || 'monthly',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      formatDate
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).render('admin/error', { 
      message: 'Failed to generate sales report', 
      error 
    });
  }
};

// Generate and download PDF report
const downloadSalesReportPDF = async (req, res) => {
  try {
    const filterType = req.query.filterType || 'monthly';
    const customStartDate = req.query.startDate;
    const customEndDate = req.query.endDate;
    
    const { startDate, endDate } = getDateRange(filterType, customStartDate, customEndDate);
    
    // Query orders within the date range
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate },
      status: { $nin: ['Cancelled', 'Return Denied', 'Returned'] }
    }).populate('userId', 'name email')
      .populate('orderedItems.product', 'productName salePrice');
    
    // Calculate report metrics
    const totalSales = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' });
    doc.moveDown();
    
    // Add summary section
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Orders: ${totalSales}`);
    doc.fontSize(12).text(`Total Order Amount: ₹${totalOrderAmount.toFixed(2)}`);
    doc.fontSize(12).text(`Total Discounts: ₹${totalDiscounts.toFixed(2)}`);
    doc.fontSize(12).text(`Total Final Amount: ₹${totalFinalAmount.toFixed(2)}`);
    doc.moveDown();
    
    // Add orders table
    doc.fontSize(16).text('Order Details', { underline: true });
    doc.moveDown();
    
    // Define column widths based on content type
    const columnWidths = {
      orderId: 70,
      date: 70,
      customer: 80,
      itemName: 150,  // Wider column for product names
      items: 40,
      amount: 70,
      discount: 70,
      final: 70
    };
    
    // Calculate total table width
    const tableWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0);
    
    // Table headers
    const tableTop = doc.y;
    const tableHeaders = ['Order ID', 'Date', 'Customer', 'Item Name', 'Items', 'Amount', 'Discount', 'Final'];
    
    // Draw headers
    let xPosition = 50;
    tableHeaders.forEach((header, i) => {
      const width = Object.values(columnWidths)[i];
      doc.fontSize(10).text(header, xPosition, tableTop, { width: width, align: 'left' });
      xPosition += width;
    });
    
    // Draw horizontal line
    doc.moveTo(50, tableTop + 20).lineTo(50 + tableWidth, tableTop + 20).stroke();
    
    // Draw rows - process ALL orders (removed the slice limitation)
    let rowTop = tableTop + 30;
    orders.forEach((order, i) => {
      // Check if we need a new page
      if (rowTop > 500) {  // Adjusted for landscape
        doc.addPage({ size: 'A4', layout: 'landscape' });
        rowTop = 50;
        
        // Redraw headers on new page
        xPosition = 50;
        tableHeaders.forEach((header, i) => {
          const width = Object.values(columnWidths)[i];
          doc.fontSize(10).text(header, xPosition, rowTop, { width: width, align: 'left' });
          xPosition += width;
        });
        
        doc.moveTo(50, rowTop + 20).lineTo(50 + tableWidth, rowTop + 20).stroke();
        rowTop += 30;
      }
      
      // Get first item name for display
      const firstItemName = order.orderedItems.length > 0 && order.orderedItems[0].product ? 
        order.orderedItems[0].product.productName : 'N/A';
      
      // Truncate product name if too long
      const truncatedName = truncateText(firstItemName, 25);
      
      // Draw row data
      xPosition = 50;
      
      // Order ID
      doc.fontSize(8).text(truncateText(order.orderId, 10), xPosition, rowTop, { width: columnWidths.orderId });
      xPosition += columnWidths.orderId;
      
      // Date
      doc.fontSize(8).text(formatDate(order.createdOn), xPosition, rowTop, { width: columnWidths.date });
      xPosition += columnWidths.date;
      
      // Customer
      doc.fontSize(8).text(truncateText(order.userId?.name || 'Unknown', 12), xPosition, rowTop, { width: columnWidths.customer });
      xPosition += columnWidths.customer;
      
      // Item Name - with proper wrapping
      doc.fontSize(8).text(truncatedName, xPosition, rowTop, { 
        width: columnWidths.itemName,
        height: 20,
        ellipsis: true
      });
      xPosition += columnWidths.itemName;
      
      // Items count
      doc.fontSize(8).text(order.orderedItems.length.toString(), xPosition, rowTop, { width: columnWidths.items });
      xPosition += columnWidths.items;
      
      // Amount
      doc.fontSize(8).text('₹' + order.totalPrice.toFixed(2), xPosition, rowTop, { width: columnWidths.amount });
      xPosition += columnWidths.amount;
      
      // Discount
      doc.fontSize(8).text('₹' + order.discount.toFixed(2), xPosition, rowTop, { width: columnWidths.discount });
      xPosition += columnWidths.discount;
      
      // Final
      doc.fontSize(8).text('₹' + order.finalAmount.toFixed(2), xPosition, rowTop, { width: columnWidths.final });
      
      rowTop += 25;  // Increased row height to prevent overlap
    });
    
    // Removed the "and X more orders" message since we're showing all orders now
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).send('Failed to generate PDF report');
  }
};

// Generate and download Excel report
const downloadSalesReportExcel = async (req, res) => {
  try {
    const filterType = req.query.filterType || 'monthly';
    const customStartDate = req.query.startDate;
    const customEndDate = req.query.endDate;
    
    const { startDate, endDate } = getDateRange(filterType, customStartDate, customEndDate);
    
    // Query orders within the date range
    const orders = await Order.find({
      createdOn: { $gte: startDate, $lte: endDate },
      status: { $nin: ['Cancelled', 'Return Denied', 'Returned'] }
    }).populate('userId', 'name email')
      .populate('orderedItems.product', 'productName salePrice');
    
    // Calculate report metrics
    const totalSales = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
    const totalFinalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    
    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');
    
    // Add title and date range
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A2:J2');
    worksheet.getCell('A2').value = `Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Add summary section
    worksheet.getCell('A4').value = 'Summary';
    worksheet.getCell('A4').font = { size: 14, bold: true };
    
    worksheet.getCell('A5').value = 'Total Orders:';
    worksheet.getCell('B5').value = totalSales;
    
    worksheet.getCell('A6').value = 'Total Order Amount:';
    worksheet.getCell('B6').value = totalOrderAmount;
    worksheet.getCell('B6').numFmt = '₹#,##0.00';
    
    worksheet.getCell('A7').value = 'Total Discounts:';
    worksheet.getCell('B7').value = totalDiscounts;
    worksheet.getCell('B7').numFmt = '₹#,##0.00';
    
    worksheet.getCell('A8').value = 'Total Final Amount:';
    worksheet.getCell('B8').value = totalFinalAmount;
    worksheet.getCell('B8').numFmt = '₹#,##0.00';
    
    // Add orders table
    worksheet.getCell('A10').value = 'Order Details';
    worksheet.getCell('A10').font = { size: 14, bold: true };
    
    // Add headers
    const headers = ['Order ID', 'Date', 'Customer', 'Email', 'Item Name', 'Payment Method', 'Items', 'Amount', 'Discount', 'Final Amount'];
    worksheet.getRow(11).values = headers;
    worksheet.getRow(11).font = { bold: true };
    
    // Set column widths
    worksheet.getColumn('A').width = 15; // Order ID
    worksheet.getColumn('B').width = 12; // Date
    worksheet.getColumn('C').width = 15; // Customer
    worksheet.getColumn('D').width = 20; // Email
    worksheet.getColumn('E').width = 30; // Item Name - wider column
    worksheet.getColumn('F').width = 15; // Payment Method
    worksheet.getColumn('G').width = 8;  // Items
    worksheet.getColumn('H').width = 12; // Amount
    worksheet.getColumn('I').width = 12; // Discount
    worksheet.getColumn('J').width = 15; // Final Amount
    
    // Add data rows
    let rowIndex = 12;
    orders.forEach(order => {
      // Get first item name for display
      const firstItemName = order.orderedItems.length > 0 && order.orderedItems[0].product ? 
        order.orderedItems[0].product.productName : 'N/A';
      
      worksheet.getRow(rowIndex).values = [
        order.orderId,
        formatDate(order.createdOn),
        order.userId?.name || 'Unknown',
        order.userId?.email || 'Unknown',
        firstItemName,
        order.paymentMethod,
        order.orderedItems.length,
        order.totalPrice,
        order.discount,
        order.finalAmount
      ];
      
      // Enable text wrapping for product name column
      worksheet.getCell(`E${rowIndex}`).alignment = { 
        wrapText: true, 
        vertical: 'middle' 
      };
      
      // Format currency cells
      worksheet.getCell(`H${rowIndex}`).numFmt = '₹#,##0.00';
      worksheet.getCell(`I${rowIndex}`).numFmt = '₹#,##0.00';
      worksheet.getCell(`J${rowIndex}`).numFmt = '₹#,##0.00';
      
      // Set row height to accommodate wrapped text
      worksheet.getRow(rowIndex).height = 25;
      
      rowIndex++;
    });
    
    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).send('Failed to generate Excel report');
  }
};


module.exports= {
    getSalesReportDashboard,
    downloadSalesReportPDF,
    downloadSalesReportExcel
}