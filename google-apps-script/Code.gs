/**
 * Google Apps Script - Backend API
 * Handles both GET and POST requests
 * Supports syncing by category with clear sheet separation
 */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Handle GET requests
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'ping') {
    return jsonResponse({ success: true, message: 'Connected' });
  }
  
  if (action === 'getSoldiers') {
    return jsonResponse({ success: true, data: getSheetData('กำลังพล') });
  }
  
  if (action === 'getAttendance') {
    return jsonResponse({ success: true, data: getSheetData('ลงเวลา') });
  }
  
  if (action === 'getTraining') {
    return jsonResponse({ success: true, data: getSheetData('ฝึกอบรม') });
  }
  
  if (action === 'getLeave') {
    return jsonResponse({ success: true, data: getSheetData('การลา') });
  }
  
  if (action === 'getEquipment') {
    return jsonResponse({ success: true, data: getSheetData('อุปกรณ์') });
  }
  
  if (action === 'getMovement') {
    return jsonResponse({ success: true, data: getSheetData('เข้าออกหน่วย') });
  }
  
  if (action === 'getSummary') {
    return jsonResponse({ 
      success: true, 
      data: {
        soldiers: getSheetData('กำลังพล').length,
        attendance: getSheetData('ลงเวลา').length,
        training: getSheetData('ฝึกอบรม').length,
        leave: getSheetData('การลา').length,
        equipment: getSheetData('อุปกรณ์').length,
        equipmentLog: getSheetData('เบิกจ่ายอุปกรณ์').length,
        movement: getSheetData('เข้าออกหน่วย').length
      }
    });
  }
  
  // Get all users from Sheets (for admin sync)
  if (action === 'getUsers') {
    var users = getSheetData('ผู้ใช้งาน').map(function(u) {
      // Don't send password back for security
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role || 'user',
        createdAt: u.createdAt
      };
    });
    return jsonResponse({ success: true, data: users });
  }
  
  return jsonResponse({ success: true, message: 'Ready' });
}

// Handle POST requests (form submission)
function doPost(e) {
  try {
    var action = e.parameter.action;
    var dataStr = e.parameter.data || '{}';
    var data = JSON.parse(dataStr);
    
    switch (action) {
      // ========== ADD Single Item ==========
      case 'addSoldier':
        addRow('กำลังพล', data.soldier);
        return jsonResponse({ success: true });
        
      case 'addAttendance':
        if (data.records && data.records.length > 0) {
          data.records.forEach(function(r) {
            addRow('ลงเวลา', r);
          });
        }
        return jsonResponse({ success: true });
        
      case 'addTraining':
        addRow('ฝึกอบรม', data.training);
        return jsonResponse({ success: true });
        
      case 'addLeave':
        addRow('การลา', data.leave);
        return jsonResponse({ success: true });
        
      case 'addEquipment':
        addRow('อุปกรณ์', data.equipment);
        return jsonResponse({ success: true });
        
      case 'addMovement':
        addRow('เข้าออกหน่วย', data.movement);
        if (data.lineChannelToken && data.lineDestId) {
             var m = data.movement;
             var msg = '';
             if (m.isVisitor) {
                 msg = '👤 ผู้มาติดต่อ: ' + m.visitorName;
                 msg += '\n🏢 มาจาก: ' + m.origin;
                 msg += '\n🎯 ติดต่อ: ' + m.destination;
                 msg += '\n🚗 ยานพาหนะ: ' + m.vehicle;
             } else {
                 msg = '💂 กำลังพล: ' + (m.soldierId || 'ไม่ระบุ'); // You might want to lookup name if possible, or client sends it?
                 // Client currently sends soldierId. Lookup is expensive here. 
                 // Ideally client should send name, OR we just show ID/Type.
                 msg += '\n📌 ประเภท: ' + (m.movementType || '-');
                 msg += '\n📝 รายละเอียด: ' + (m.reason || '-');
             }
             sendLinePushMessage("📢 บันทึกเข้า-ออกใหม่\n" + msg, data.lineChannelToken, data.lineDestId);
        }
        return jsonResponse({ success: true });
      
      // ========== Authentication ==========
      case 'login':
        var user = findUser(data.username, data.password);
        if (user) {
          return jsonResponse({ success: true, user: user });
        } else {
          return jsonResponse({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        
      case 'register':
        // Check if username exists
        if (checkUsernameExists(data.username)) {
          return jsonResponse({ success: false, error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }
        addRow('ผู้ใช้งาน', data);
        return jsonResponse({ success: true });
      
      // ========== User Management ==========
      case 'syncUsers':
        syncSheet('ผู้ใช้งาน', data.users);
        return jsonResponse({ success: true, count: data.users ? data.users.length : 0, sheet: 'ผู้ใช้งาน' });
        
      case 'updateUser':
        updateRow('ผู้ใช้งาน', data.user);
        return jsonResponse({ success: true });
        
      case 'deleteUserById':
        deleteRow('ผู้ใช้งาน', data.id);
        return jsonResponse({ success: true });
      
      // ========== SYNC Category (Clear & Replace) ==========
      case 'syncSoldiers':
        syncSheet('กำลังพล', data.soldiers);
        return jsonResponse({ success: true, count: data.soldiers ? data.soldiers.length : 0, sheet: 'กำลังพล' });
      
      case 'syncOfficers':
        syncSheet('Officers', data.officers);
        return jsonResponse({ success: true, count: data.officers ? data.officers.length : 0, sheet: 'Officers' });
      
      case 'syncEnlisted':
        syncSheet('Enlisted', data.enlisted);
        return jsonResponse({ success: true, count: data.enlisted ? data.enlisted.length : 0, sheet: 'Enlisted' });
        
      case 'syncAttendance':
        syncSheet('ลงเวลา', data.records);
        return jsonResponse({ success: true, count: data.records ? data.records.length : 0, sheet: 'ลงเวลา' });
        
      case 'syncTraining':
        syncSheet('ฝึกอบรม', data.training);
        return jsonResponse({ success: true, count: data.training ? data.training.length : 0, sheet: 'ฝึกอบรม' });
        
      case 'syncLeave':
        syncSheet('การลา', data.leave);
        return jsonResponse({ success: true, count: data.leave ? data.leave.length : 0, sheet: 'การลา' });
        
      case 'syncEquipment':
        syncSheet('อุปกรณ์', data.equipment);
        return jsonResponse({ success: true, count: data.equipment ? data.equipment.length : 0, sheet: 'อุปกรณ์' });
        
      case 'syncEquipmentLog':
        syncSheet('เบิกจ่ายอุปกรณ์', data.equipmentLog);
        return jsonResponse({ success: true, count: data.equipmentLog ? data.equipmentLog.length : 0, sheet: 'เบิกจ่ายอุปกรณ์' });
        
      case 'syncMovement':
        // Get existing IDs to avoid spam
        var existingMovIds = [];
        try {
          var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('เข้าออกหน่วย');
          if (sheet && sheet.getLastRow() > 1) {
             existingMovIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
          }
        } catch (e) { Logger.log('Error reading Mov IDs: ' + e); }

        var movRequests = [];
        var processedMovs = data.movement.map(function(m) {
           var isNew = existingMovIds.indexOf(m.id.toString()) === -1;
           if (isNew && data.lineChannelToken && data.lineDestId) {
               var msg = '';
               if (m.isVisitor) {
                   msg = '👤 ผู้มาติดต่อ: ' + m.visitorName;
                   msg += '\n🏢 มาจาก: ' + m.origin;
                   msg += '\n🎯 ติดต่อ: ' + m.destination;
               } else {
                   msg = '💂 กำลังพล'; 
                   msg += '\n📌 ประเภท: ' + m.movementType;
                   msg += '\n📝 เหตุผล: ' + m.reason;
               }
               
               var req = createLineRequest(
                 "📢 รายงานเข้า-ออก (Sync)\n" + msg, 
                 data.lineChannelToken, 
                 data.lineDestId
               );
               if (req) movRequests.push(req);
           }
           return m;
        });
        
        // Execute batch notifications
        sendBatchedRequests(movRequests);
        
        syncSheet('เข้าออกหน่วย', processedMovs);
        return jsonResponse({ success: true, count: processedMovs.length, sheet: 'เข้าออกหน่วย' });
      
      case 'syncGuardPatrol':
        // Get existing IDs
        var existingIds = [];
        try {
          var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ตรวจยาม');
          if (sheet && sheet.getLastRow() > 1) {
             existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
          }
        } catch (e) {
          Logger.log('Error reading existing IDs: ' + e);
        }
        
        var patrolRequests = [];
        var processedPatrols = data.guardPatrol.map(function(item) {
          var isNew = existingIds.indexOf(item.id.toString()) === -1;

          if (item.images && item.images.startsWith('data:image')) {
            var imageUrl = saveImageToDrive(item.images, 'GuardPatrol_Images', 'IMG_' + item.id);
            item.images = imageUrl;
          }
          
          if (isNew && data.lineChannelToken && data.lineDestId) {
             var title = '';
             var body = '� วันที่: ' + item.date + ' ' + (item.time || '');
             body += '\n🏢 โซน: ' + (item.zone || '-');
             body += '\n🔄 ผลัด: ' + (item.shift || '-') + ' วงรอบ: ' + (item.round || '-');
             body += '\n�📍 จุด: ' + item.checkpointName;
             body += '\n👮 ผู้ตรวจ: ' + (item.guardName || item.guardId);
             
             if (item.status === 'normal') {
                 title = '✅ ตรวจปกติ';
             } else if (item.status === 'issue') {
                 title = '⚠️ พบปัญหา';
                 body += '\n📝 รายละเอียด: ' + item.note;
             } else if (item.status === 'urgent') {
                 title = '🚨 เร่งด่วน!';
                 body += '\n📝 รายละเอียด: ' + item.note;
             }

             if (item.beachArea || item.seaDistance || item.tourists || item.fishermen) {
                body += '\n📊 สภาพแวดล้อม:';
                if (item.beachArea) body += '\n🏖️ หาด: ' + item.beachArea;
                if (item.seaDistance) body += '\n🌊 ระยะน้ำ: ' + item.seaDistance;
                if (item.tourists) body += '\n👥 นทท.: ' + item.tourists;
                if (item.fishermen) body += '\n🚣 ประมง: ' + item.fishermen;
             }
             
             if (item.latitude && item.longitude) {
               body += '\n🗺️ พิกัด: https://maps.google.com/?q=' + item.latitude + ',' + item.longitude;
             }
             
             var req = createLineRequest(title + '\n' + body, data.lineChannelToken, data.lineDestId, item.images);
             if (req) patrolRequests.push(req);
          }

          return item;
        });
        
        // Execute batch notifications (FAST!)
        sendBatchedRequests(patrolRequests);
        
        syncSheet('ตรวจยาม', processedPatrols);
        return jsonResponse({ success: true, count: processedPatrols.length, sheet: 'ตรวจยาม' });
      
      case 'testLineMessage':
        if (data.channelToken && data.destId) {
           var res = sendLinePushMessage("✅ ทดสอบการเชื่อมต่อ MilitaryMS (LINE OA) พร้อมใช้งานครับ", data.channelToken, data.destId);
           if (res === true) {
             return jsonResponse({ success: true });
           } else {
             return jsonResponse({ success: false, error: res }); 
           }
        }
        return jsonResponse({ success: false, error: 'Missing token or destId' });
      
      // ========== Legacy Support ==========
      case 'addSoldiers':
        if (data.soldiers && data.soldiers.length > 0) {
          data.soldiers.forEach(function(s) {
            addRow('กำลังพล', s);
          });
        }
        return jsonResponse({ success: true, count: data.soldiers ? data.soldiers.length : 0 });
        
      // ========== UPDATE ==========
      case 'updateSoldier':
      case 'updateSoldiers':
        updateRow('กำลังพล', data.item);
        return jsonResponse({ success: true });
        
      case 'updateAttendance':
        updateRow('ลงเวลา', data.item);
        return jsonResponse({ success: true });
        
      case 'updateTraining':
        updateRow('ฝึกอบรม', data.item);
        return jsonResponse({ success: true });
        
      case 'updateLeave':
        updateRow('การลา', data.item);
        return jsonResponse({ success: true });
        
      case 'updateEquipment':
        updateRow('อุปกรณ์', data.item);
        return jsonResponse({ success: true });
        
      case 'updateMovement':
        updateRow('เข้าออกหน่วย', data.item);
        return jsonResponse({ success: true });
        
      // ========== DELETE ==========
      case 'deleteSoldier':
      case 'deleteSoldiers':
        deleteRow('กำลังพล', data.id);
        return jsonResponse({ success: true });
        
      case 'deleteAttendance':
        deleteRow('ลงเวลา', data.id);
        return jsonResponse({ success: true });
        
      case 'deleteTraining':
        deleteRow('ฝึกอบรม', data.id);
        return jsonResponse({ success: true });
        
      case 'deleteLeave':
        deleteRow('การลา', data.id);
        return jsonResponse({ success: true });
        
      case 'deleteEquipment':
        deleteRow('อุปกรณ์', data.id);
        return jsonResponse({ success: true });
        
      case 'deleteMovement':
        deleteRow('เข้าออกหน่วย', data.id);
        return jsonResponse({ success: true });
        
      default:
        return jsonResponse({ success: true, action: action });
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

/**
 * Sync entire sheet - Clear and replace all data
 */
function syncSheet(sheetName, items) {
  if (!items || items.length === 0) {
    return;
  }
  
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('Sheet not found: ' + sheetName);
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Clear existing data (keep headers)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  // Add all items
  var rows = items.map(function(item) {
    return headers.map(function(h) { 
      return item[h] !== undefined ? item[h] : ''; 
    });
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  Logger.log('Synced ' + sheetName + ': ' + rows.length + ' rows');
}

/**
 * Get all data from a sheet
 */
function getSheetData(sheetName) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }
  
  var headers = data[0];
  var rows = data.slice(1);
  
  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { 
      obj[h] = row[i]; 
    });
    return obj;
  });
}

/**
 * Add single row
 */
function addRow(sheetName, item) {
  if (!item) {
    return;
  }
  
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { 
    return item[h] || ''; 
  });
  
  sheet.appendRow(row);
}

/**
 * Update row
 */
function updateRow(sheetName, item) {
  if (!item || !item.id) {
    return;
  }
  
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === item.id) {
      var row = headers.map(function(h) {
        return item[h] !== undefined ? item[h] : data[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
}

/**
 * Delete row
 */
function deleteRow(sheetName, id) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * JSON response
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initialize all sheets with headers (run once)
 */
function initializeSheets() {
  var ss = getSpreadsheet();
  
  // กำลังพล (Soldiers) - รวมทั้งหมด
  createSheet(ss, 'กำลังพล', [
    'id', 'soldierId', 'rank', 'firstName', 'lastName', 
    'position', 'unit', 'phone', 'bloodType', 'joinDate', 
    'userId', 'status', 'createdAt', 'updatedAt'
  ]);
  
  // นายทหารสัญญาบัตร (Officers)
  createSheet(ss, 'Officers', [
    'id', 'soldierId', 'rank', 'firstName', 'lastName', 
    'position', 'unit', 'phone', 'bloodType', 'joinDate', 
    'userId', 'status', 'createdAt', 'updatedAt'
  ]);
  
  // นายประทวน + พลทหาร (Enlisted)
  createSheet(ss, 'Enlisted', [
    'id', 'soldierId', 'rank', 'firstName', 'lastName', 
    'position', 'unit', 'phone', 'bloodType', 'joinDate', 
    'userId', 'status', 'createdAt', 'updatedAt'
  ]);
  
  // ลงเวลา (Attendance)
  createSheet(ss, 'ลงเวลา', [
    'id', 'soldierId', 'date', 'checkIn', 'checkOut', 
    'status', 'note', 'createdAt', 'updatedAt'
  ]);
  
  // ฝึกอบรม (Training)
  createSheet(ss, 'ฝึกอบรม', [
    'id', 'trainingId', 'trainingName', 'description', 
    'startDate', 'endDate', 'location', 'instructor', 
    'participants', 'status', 'result', 'createdAt', 'updatedAt'
  ]);
  
  // การลา (Leave)
  createSheet(ss, 'การลา', [
    'id', 'leaveId', 'soldierId', 'leaveType', 
    'startDate', 'endDate', 'reason', 'contact', 
    'status', 'approvedBy', 'approvedDate', 'rejectReason', 
    'createdAt', 'updatedAt'
  ]);
  
  // อุปกรณ์ (Equipment)
  createSheet(ss, 'อุปกรณ์', [
    'id', 'equipmentId', 'name', 'category', 'quantity', 
    'unit', 'location', 'description', 'status', 
    'lastCheck', 'createdAt', 'updatedAt'
  ]);
  
  // ประวัติเบิก-คืนอุปกรณ์ (Equipment Log)
  createSheet(ss, 'เบิกจ่ายอุปกรณ์', [
    'id', 'equipmentId', 'soldierId', 'action', 'quantity', 
    'date', 'returnDate', 'expectedReturn', 'note', 
    'returnNote', 'createdAt', 'updatedAt'
  ]);
  
  // เข้าออกหน่วย (Movement)
  createSheet(ss, 'เข้าออกหน่วย', [
    'id', 'soldierId', 'movementType', 'date', 'time', 
    'period', 'destination', 'reason', 'returnDate', 
    'note', 'createdAt', 'updatedAt'
  ]);
  
  // ตรวจป้อม (Guard Patrol)
  createSheet(ss, 'ตรวจยาม', [
    'id', 'date', 'shift', 'round', 'time',
    'checkpointId', 'checkpointName', 'zone', 'guardId',
    'status', 'note', 'latitude', 'longitude', 'images',
    'beachArea', 'seaDistance', 'tourists', 'fishermen',
    'createdAt', 'updatedAt'
  ]);
  
  // ผู้ใช้ระบบ (Users)
  createSheet(ss, 'ผู้ใช้งาน', [
    'id', 'username', 'password', 'displayName', 'role', 'createdAt'
  ]);
  
  Logger.log('All sheets initialized successfully');
}

/**
 * Find user by username and password
 */
function findUser(username, password) {
  var sheet = getSpreadsheet().getSheetByName('ผู้ใช้งาน');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var usernameIndex = headers.indexOf('username');
  var passwordIndex = headers.indexOf('password');
  var idIndex = headers.indexOf('id');
  var displayNameIndex = headers.indexOf('displayName');
  var roleIndex = headers.indexOf('role');
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][usernameIndex] === username && data[i][passwordIndex] === password) {
      return {
        id: data[i][idIndex],
        username: data[i][usernameIndex],
        displayName: data[i][displayNameIndex],
        role: data[i][roleIndex]
      };
    }
  }
  return null;
}

/**
 * Check if username exists
 */
function checkUsernameExists(username) {
  var sheet = getSpreadsheet().getSheetByName('ผู้ใช้งาน');
  if (!sheet) return false;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var usernameIndex = headers.indexOf('username');
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][usernameIndex] === username) {
      return true;
    }
  }
  return false;
}

/**
 * Create sheet with headers
 */
function createSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log('Created sheet: ' + name);
  }
  
  // Set headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4CAF50')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
}
/**
 * Save Base64 image to Google Drive
 */
function saveImageToDrive(base64Data, folderName, fileName) {
  try {
    // 1. Get or create folder
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // 2. Process Base64
    var contentType = base64Data.split(',')[0].split(':')[1].split(';')[0];
    var bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    var blob = Utilities.newBlob(bytes, contentType, fileName);
    
    // 3. Create file
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getDownloadUrl(); // Or file.getUrl() for preview link
  } catch (e) {
    Logger.log('Error saving image: ' + e.toString());
    return 'Error: ' + e.toString();
  }
}

/**
 * TEST FUNCTION: Run this to check Drive permissions
 */
function testDriveIntegration() {
  try {
    var folderName = "GuardPatrol_Images";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    
    if (folders.hasNext()) {
      folder = folders.next();
      Logger.log("Found existing folder: " + folder.getUrl());
    } else {
      folder = DriveApp.createFolder(folderName);
      Logger.log("Created new folder: " + folder.getUrl());
    }
    
    // Create a dummy file to test file creation
    var file = folder.createFile("test_permission.txt", "Drive permission check passed!");
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    Logger.log("Test execution successful.");
    Logger.log("Test File URL: " + file.getDownloadUrl());
    
    return "Success! Check Logger (View > Execution transcript)";
  } catch (e) {
    Logger.log("Error: " + e.toString());
    return "Error: " + e.toString();
  }
}

/**
 * Send LINE Push Message (Messaging API)
 */
function sendLinePushMessage(message, token, destId, imageUrl) {
  try {
    var messages = [
      {
        "type": "text",
        "text": message
      }
    ];
    
    // Add image message if URL exists and is valid
    if (imageUrl && imageUrl.startsWith('http')) {
      messages.push({
        "type": "image",
        "originalContentUrl": imageUrl,
        "previewImageUrl": imageUrl
      });
    }

    var payload = {
      "to": destId,
      "messages": messages
    };
    
    var options = {
      'method': 'post',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    Logger.log('LINE Response: ' + response.getContentText());
    return true;
  } catch (e) {
    Logger.log('LINE Push Error: ' + e.toString());
    return 'Error: ' + e.toString();
  }
}

/**
 * Create LINE Request Object (for Batching)
 */
function createLineRequest(message, token, destId, imageUrl) {
  try {
    var messages = [
      {
        "type": "text",
        "text": message
      }
    ];
    
    // Add image message if URL exists and is valid
    if (imageUrl && imageUrl.startsWith('http')) {
      messages.push({
        "type": "image",
        "originalContentUrl": imageUrl,
        "previewImageUrl": imageUrl
      });
    }

    var payload = {
      "to": destId,
      "messages": messages
    };
    
    return {
      'url': 'https://api.line.me/v2/bot/message/push',
      'method': 'post',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
  } catch (e) {
    Logger.log('Error creating request: ' + e);
    return null;
  }
}

/**
 * Send Batched Requests (Parallel)
 */
function sendBatchedRequests(requests) {
  if (!requests || requests.length === 0) return;
  
  try {
    // UrlFetchApp.fetchAll allows parallel requests
    // Batching in chunks of 30 to stay safe
    var chunkSize = 30;
    for (var i = 0; i < requests.length; i += chunkSize) {
       var chunk = requests.slice(i, i + chunkSize);
       var responses = UrlFetchApp.fetchAll(chunk);
       Logger.log('Batch sent chunk ' + i + ', responses: ' + responses.length);
    }
  } catch (e) {
    Logger.log('Error batch sending: ' + e);
  }
}
