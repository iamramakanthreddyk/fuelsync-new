
# 📖 FuelSync User Manual

## 🎯 Getting Started

### Login & Account Setup

1. **Access FuelSync**: Visit your FuelSync dashboard URL
2. **Login**: Use your provided credentials
3. **First-Time Setup**: 
   - Complete your profile information
   - Set up your fuel station details (Pump Owners)
   - Configure initial pump and nozzle settings

### Role-Specific Dashboards

#### 🔧 Super Admin Dashboard
- **Overview**: Platform-wide statistics and performance metrics
- **User Management**: View, create, edit, and manage all users
- **Plan Management**: Upgrade/downgrade user plans
- **Global Analytics**: Cross-station insights and trends

#### 🏢 Pump Owner Dashboard  
- **Station Overview**: Your station's performance metrics
- **Sales Summary**: Daily, weekly, and monthly sales data
- **Quick Actions**: Upload receipts, update prices, manage pumps
- **Employee Management**: Add/remove employees within plan limits

#### 👤 Employee Dashboard
- **Upload Interface**: Simple receipt upload and processing
- **Upload History**: View your submitted receipts and their status
- **Basic Analytics**: Your upload statistics

---

## 📄 Uploads & Manual Processing

### Uploading Receipts or Entering Readings

1. **Navigate to Upload Page**
   - Click "Upload Receipt" from dashboard or sidebar or use the quick action button

2. **Select File or Enter Data**
   - Click "Choose File" or drag & drop a receipt image (optional)
   - Or use the manual entry form to record meter readings or sale details
   - Supported file formats: JPG, PNG, JPEG (Max 10MB)

3. **Submit**
   - Click "Submit" to save the upload or reading
   - If you provided a file, it will be stored; processing is manual or via device integration

4. **Verify & Edit Data**
   - Confirm amount, litres, and fuel type are correct
   - Edit any incorrect information and save

### Upload Status Types

- **🟢 Pending**: Upload received and awaiting manual review or device processing
- **✅ Processed**: Data confirmed and saved
- **🔴 Failed**: Upload failed (try again or contact support)

### Best Practices

✅ **Good Receipt Quality** (if uploading images):
- Clear, well-lit photos
- All text visible and readable
- Minimal shadows or glare
- Straight orientation (not tilted)

❌ **Avoid**:
- Blurry or dark images
- Crumpled or damaged receipts
- Multiple receipts in one image

---

## ⛽ Pump & Nozzle Management

### Viewing Pump Status

1. **Navigate to Pumps Page**
2. **View Pump Grid**: See all pumps with status indicators
   - 🟢 Active: Pump is operational
   - 🔴 Inactive: Pump is offline
   - 🟡 Maintenance: Pump under maintenance

### Adding New Pumps (Pump Owners)

1. **Check Plan Limits**: Ensure you haven't reached your pump limit
2. **Click "Add Pump"**
3. **Enter Pump Details**:
   - Pump name (e.g., "Pump 1", "North Side Pump")
   - Location description
4. **Configure Nozzles**: Set fuel type for each nozzle
5. **Save Configuration**

### Updating Pump Status

1. **Select Pump**: Click on the pump you want to update
2. **Change Status**: Choose from Active, Inactive, or Maintenance
3. **Confirm Changes**: Click "Update Status"

### Nozzle Configuration

1. **Access Pump Details**: Click on a specific pump
2. **Edit Nozzle Settings**:
   - Assign fuel type (Petrol/Diesel) to each nozzle
   - Update nozzle numbers if needed
3. **Save Changes**: Confirm nozzle configuration

---

## 💰 Fuel Price Management

### Viewing Current Prices

1. **Navigate to Prices Page**
2. **View Price Table**: See current prices for Petrol and Diesel
3. **Check Price History**: Review recent price changes

### Updating Fuel Prices (Pump Owners & Super Admin)

1. **Select Fuel Type**: Choose Petrol or Diesel
2. **Enter New Price**: Input price per litre
3. **Review Price Change**: Check the difference from current price
4. **Update Price**: Click "Update Price"
5. **Confirmation**: Price update is applied immediately

### Price Comparison

- **Competitor Analysis**: View nearby station prices
- **Market Position**: See how your prices compare
- **Pricing Strategy**: Make informed pricing decisions

---

## 📊 Sales Analytics & Reports

### Daily Summary

1. **Select Date**: Choose the date you want to analyze
2. **View Metrics**:
   - Total revenue for the day
   - Litres sold by fuel type
   - Number of transactions
   - Hourly breakdown

### Sales Trends

1. **Choose Time Period**: 7 days, 30 days, or custom range
2. **Analyze Trends**:
   - Revenue patterns
   - Volume trends
   - Peak hours identification
   - Fuel type performance

### Generating Reports

1. **Navigate to Reports Page**
2. **Select Report Type**:
   - Daily sales summary
   - Weekly performance
   - Monthly analytics
   - Custom date range
3. **Choose Format**: PDF or Excel
4. **Generate & Download**: Click "Export Report"

---

## 👥 User Management (Pump Owners)

### Adding Employees

1. **Check Plan Limits**: Ensure you can add more employees
2. **Navigate to Settings** → **Team Management**
3. **Click "Add Employee"**
4. **Enter Employee Details**:
   - Full name
   - Email address
   - Create password
5. **Assign Permissions**: Employees get upload-only access
6. **Send Invitation**: Employee receives login credentials

### Managing Employees

- **View Team**: See all employees and their activity
- **Update Information**: Edit employee details
- **Remove Access**: Delete employee accounts when needed
- **Monitor Activity**: Track employee upload statistics

---

## 👨‍💼 Super Admin Functions

### User Management

1. **View All Users**: Access complete user directory
2. **Create Pump Owners**:
   - Set up new fuel station accounts
   - Assign appropriate plans
   - Configure station details
3. **Plan Management**:
   - Upgrade/downgrade user plans
   - Monitor plan usage and limits
   - Handle billing-related plan changes

### Platform Analytics

- **Global Statistics**: Platform-wide performance metrics
- **User Activity**: Monitor user engagement and usage
- **System Health**: Track system performance and issues
- **Revenue Analytics**: Platform revenue and growth metrics

### Account Management

1. **User Plan Changes**:
   - Select user to modify
   - Choose new plan (Basic/Premium/Enterprise)
   - Confirm plan change
   - User immediately gets new plan benefits/limits

2. **Account Deletion** (Requires Confirmation):
   - Select user to delete
   - Confirm deletion (this is permanent)
   - All user data will be removed

---

## ⚙️ Settings & Configuration

### Profile Settings

1. **Personal Information**:
   - Update name and contact details
   - Change password
   - Set notification preferences

2. **Station Information** (Pump Owners):
   - Update station name and address
   - Configure operational hours
   - Set station-specific preferences

### Notification Settings

- **OCR Processing**: Get notified when receipts are processed
- **Price Alerts**: Notifications for price changes
- **Maintenance Reminders**: Schedule pump maintenance alerts
- **Daily Reports**: Automatic daily summary emails

### Security Settings

- **Two-Factor Authentication**: Enable 2FA for enhanced security
- **Session Management**: Control session timeout
- **Password Policy**: Set password expiration rules

---

## 📱 Mobile Usage

### PWA Installation

1. **Visit FuelSync** on your mobile browser
2. **Add to Home Screen**: Follow browser prompts
3. **Offline Access**: Basic functionality works offline
4. **Push Notifications**: Enable for real-time updates

### Mobile Best Practices

- **Receipt Photos**: Use good lighting and steady hands
- **Touch Interface**: All controls are optimized for touch
- **Quick Actions**: Access common functions from dashboard
- **Responsive Design**: Works on all screen sizes

---

## 🔧 Troubleshooting

### Common Issues

### Upload Problems
- **Issue**: Receipt upload fails
- **Solution**: Check image quality, file size (<10MB), and internet connection

#### Login Issues
- **Issue**: Cannot access account
- **Solution**: Check credentials, reset password, or contact support

#### Plan Limit Reached
- **Issue**: Cannot add more pumps/employees
- **Solution**: Upgrade plan or remove inactive resources

### Getting Help

1. **Built-in Help**: Click "?" icons for contextual help
2. **User Guide**: Access this manual from Settings
3. **Support Contact**: Email support@fuelsync.app
4. **Community**: Join our Discord for peer support

---

## 📞 Support & Contact

### Technical Support
- **Email**: support@fuelsync.app
- **Response Time**: 24-48 hours for standard plans, 4-8 hours for Enterprise
- **Priority Support**: Available for Enterprise customers

### Feature Requests
- **Feedback Portal**: Submit feature suggestions
- **Community Discussion**: Join Discord for feature discussions
- **Enterprise Customers**: Direct line to product team

### Training & Onboarding
- **Self-Service**: This user guide and video tutorials
- **Basic Support**: Email-based assistance
- **Enterprise Training**: Custom training sessions available

---

## 🚀 Tips for Success

### Maximize Efficiency
1. **Daily Uploads**: Upload receipts daily for accurate tracking
2. **Price Monitoring**: Check competitor prices weekly
3. **Analytics Review**: Review weekly trends for insights
4. **Team Training**: Ensure all employees know how to upload receipts

### Best Practices
- **Data Quality**: Always verify OCR extracted data
- **Regular Maintenance**: Keep pump status updated
- **Plan Optimization**: Monitor usage and upgrade when beneficial
- **Security**: Use strong passwords and enable 2FA

### Growth Strategies
- **Analytics-Driven Decisions**: Use data to optimize operations
- **Competitive Pricing**: Leverage price comparison data
- **Employee Efficiency**: Train team for consistent data entry
- **Plan Scaling**: Upgrade plans as your business grows

---

**Need more help?** Contact our support team at support@fuelsync.app or visit our community Discord server.
