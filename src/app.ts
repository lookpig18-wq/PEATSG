import { 
  db, auth, 
  onAuthStateChanged, 
  collection, onSnapshot, query, setDoc, doc, deleteDoc, getDocs, serverTimestamp 
} from './firebase';

// Types
interface Disbursement {
  id: string;
  accountCode: string;
  accountName: string;
  costCenter: string;
  date: string;
  voucherNumber?: string;
  description: string;
  price: string;
  tax: string;
  totalPrice: string;
  wht: string;
  netTotal: string;
  payee: string;
  paymentMethod: string;
  chequeNumber?: string;
  attachment: string | null;
  attachmentName: string | null;
  budgetSource?: string;
  wbs?: string;
  createdAt?: any;
}

interface Account {
  code: string;
  name: string;
  importantType?: 'none' | 'operating' | '7categories' | 'both';
  budgets: {
    [key: string]: number;
  };
}

interface User {
  username: string;
  password: string;
  role?: string;
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginScreen = document.getElementById('login-screen')!;
    const appContainer = document.getElementById('app-container')!;
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const loginError = document.getElementById('login-error')!;
    const guestLoginBtn = document.getElementById('guest-login-btn')!;

    const form = document.getElementById('disbursement-form') as HTMLFormElement;
    const formTitle = document.getElementById('form-title')!;
    const tableBody = document.getElementById('disbursement-table-body')!;
    const tableSearch = document.getElementById('table-search') as HTMLInputElement;
    const disbursementIdInput = document.getElementById('disbursement-id') as HTMLInputElement;
    const priceInput = document.getElementById('price') as HTMLInputElement;
    const taxInput = document.getElementById('tax') as HTMLInputElement;
    const totalPriceInput = document.getElementById('total-price') as HTMLInputElement;
    const whtInput = document.getElementById('wht') as HTMLInputElement;
    const netTotalInput = document.getElementById('net-total') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn')!;
    const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    const exportRecordedDataBtn = document.getElementById('export-recorded-data-btn')!;
    const exportDisbursementSummaryBtn = document.getElementById('export-disbursement-summary-btn')!;
    const exportBudgetSummaryBtn = document.getElementById('export-budget-summary-btn')!;
    const summaryMonth = document.getElementById('summary-month') as HTMLInputElement;
    const summaryStartDate = document.getElementById('summary-start-date') as HTMLInputElement;
    const summaryEndDate = document.getElementById('summary-end-date') as HTMLInputElement;
    const summaryDeptFilter = document.getElementById('summary-dept-filter') as HTMLSelectElement;
    const attachmentContainer = document.getElementById('attachment-container')!;
    const attachmentInput = document.getElementById('attachment') as HTMLInputElement;
    const attachmentNameDisplay = document.getElementById('attachment-name')!;
    const attachmentTypeRadios = document.querySelectorAll('input[name="attachment-type"]') as NodeListOf<HTMLInputElement>;
    const attachmentFileDiv = document.getElementById('attachment-file-div')!;
    const attachmentLinkDiv = document.getElementById('attachment-link-div')!;
    const attachmentUrlInput = document.getElementById('attachment-url') as HTMLInputElement;

    // Tab Elements
    const tabEntryBtn = document.getElementById('tab-entry-btn')!;
    const tabSummaryBtn = document.getElementById('tab-summary-btn')!;
    const tabEntryContent = document.getElementById('tab-entry-content')!;
    const tabSummaryContent = document.getElementById('tab-summary-content')!;

    // Tab Logic
    const switchTab = (activeTab: 'entry' | 'summary') => {
        // Hide all
        tabEntryContent.classList.add('hidden');
        tabSummaryContent.classList.add('hidden');
        
        // Reset buttons
        [tabEntryBtn, tabSummaryBtn].forEach(btn => {
            btn.classList.remove('bg-white', 'text-indigo-900', 'shadow-md');
            btn.classList.add('text-white', 'hover:bg-white/10');
        });
        
        // Show active
        if (activeTab === 'entry') {
            tabEntryContent.classList.remove('hidden');
            tabEntryBtn.classList.add('bg-white', 'text-indigo-900', 'shadow-md');
            tabEntryBtn.classList.remove('text-white', 'hover:bg-white/10');
        } else if (activeTab === 'summary') {
            tabSummaryContent.classList.remove('hidden');
            tabSummaryBtn.classList.add('bg-white', 'text-indigo-900', 'shadow-md');
            tabSummaryBtn.classList.remove('text-white', 'hover:bg-white/10');
            updateSummary();
        }
    };

    tabEntryBtn.addEventListener('click', () => switchTab('entry'));
    tabSummaryBtn.addEventListener('click', () => switchTab('summary'));

    const budgetSourceInput = document.getElementById('budget-source') as HTMLSelectElement;
    const wbsContainer = document.getElementById('wbs-container')!;
    const wbsInput = document.getElementById('wbs') as HTMLInputElement;
    const accountDetailsContainer = document.getElementById('account-details-container')!;
    const accountCodeInput = document.getElementById('account-code') as HTMLInputElement;
    const accountNameInput = document.getElementById('account-name') as HTMLInputElement;
    const costCenterInput = document.getElementById('cost-center') as HTMLSelectElement;
    const voucherNumberInput = document.getElementById('voucher-number') as HTMLInputElement;
    const paymentMethodInput = document.getElementById('payment-method') as HTMLSelectElement;
    const chequeNumberContainer = document.getElementById('cheque-number-container')!;
    const chequeNumberInput = document.getElementById('cheque-number') as HTMLInputElement;
    const accountCodesDatalist = document.getElementById('account-codes')!;
    const budgetInfo = document.getElementById('budget-info');
    const budgetAllocatedDisplay = document.getElementById('budget-allocated');
    const budgetRemainingDisplay = document.getElementById('budget-remaining');
    const budgetProgress = document.getElementById('budget-progress');
    const budgetUsageText = document.getElementById('budget-usage-text');

    // State
    let disbursements: Disbursement[] = [];
    let accountData: Account[] = [];
    let users: User[] = [];
    
    // Pagination State
    let currentPage = 1;
    const itemsPerPage = 10;

    const defaultAccountData: Account[] = [
        { code: "52010030", name: "ค่าล่วงเวลาพนักงาน", importantType: 'operating', budgets: { "ผบง.": 50000, "กบห.": 0, "ผปร.": 480000, "ผบค.": 370000 } },
        { code: "52010100", name: "ค่าล่วงเวลา - ลูกจ้าง", importantType: 'none', budgets: { "ผบง.": 26000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "52010990", name: "ค่าตอบแทนอื่น-พนักงาน", importantType: 'none', budgets: { "ผบง.": 7000, "กบห.": 8500, "ผปร.": 7000, "ผบค.": 7000 } },
        { code: "52012020", name: "เงินเพิ่มฮอทไลน์", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 62000, "ผบค.": 0 } },
        { code: "52012070", name: "ค่าโทรศัพท์เคลื่อนที่-ผู้บริหาร", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 12000, "ผปร.": 0, "ผบค.": 0 } },
        { code: "52020030", name: "เงินช่วยเหลือค่าเล่าเรียนบุตร", importantType: 'none', budgets: { "ผบง.": 6000, "กบห.": 0, "ผปร.": 0, "ผบค.": 26000 } },
        { code: "52020990", name: "เงินช่วยเหลืออื่น", importantType: 'none', budgets: { "ผบง.": 4500, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "52022010", name: "ค่าพาหนะเดินทางไปปฏิบัติงานต่างท้องที่-พนักงาน", importantType: 'operating', budgets: { "ผบง.": 500, "กบห.": 500, "ผปร.": 500, "ผบค.": 500 } },
        { code: "52022020", name: "ค่าเบี้ยเลี้ยง-พนักงาน", importantType: 'operating', budgets: { "ผบง.": 20000, "กบห.": 23000, "ผปร.": 22000, "ผบค.": 22000 } },
        { code: "52022030", name: "ค่าที่พัก-พนักงาน", importantType: 'operating', budgets: { "ผบง.": 35000, "กบห.": 39000, "ผปร.": 35000, "ผบค.": 35000 } },
        { code: "52022050", name: "ค่าชดเชยการใช้ยานพาหนะส่วนตัว", importantType: 'operating', budgets: { "ผบง.": 37000, "กบห.": 10000, "ผปร.": 37000, "ผบค.": 37000 } },
        { code: "52029010", name: "ค่าเช่าบ้าน", importantType: 'none', budgets: { "ผบง.": 72000, "กบห.": 72000, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53010020", name: "ค่าตอบแทน-การจดหน่วยและแจ้งหนี้กระแสไฟฟ้า", importantType: 'operating', budgets: { "ผบง.": 1740000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53010070", name: "ค่าแรง/ค่าจ้างเหมาคนงานรายวันงานบำรุงรักษา", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 1250000, "ผบค.": 0 } },
        { code: "53010080", name: "ค่าแรง/ค่าจ้างเหมาคนงานรายวันงานบริการ", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 0, "ผบค.": 660000 } },
        { code: "53010090", name: "ค่าแรง/ค่าจ้างเหมาคนงานรายวันทั่วไป", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 370000, "ผบค.": 0 } },
        { code: "53019990", name: "ค่าตอบแทนอื่น ๆ", importantType: 'none', budgets: { "ผบง.": 5000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53021010", name: "ค่าป้ายประชาสัมพันธ์", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 0, "ผบค.": 4500 } },
        { code: "53021020", name: "ค่าประชาสัมพันธ์อื่น", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 0, "ผบค.": 15000 } },
        { code: "53021030", name: "ค่าประชาสัมพันธ์ทางสื่อ", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 0, "ผบค.": 1000 } },
        { code: "53030010", name: "ค่าวัสดุสำนักงาน", importantType: 'operating', budgets: { "ผบง.": 65000, "กบห.": 0, "ผปร.": 65000, "ผบค.": 65000 } },
        { code: "53030030", name: "ค่าวัสดุเบ็ดเตล็ด", importantType: 'none', budgets: { "ผบง.": 38000, "กบห.": 0, "ผปร.": 7000, "ผบค.": 7000 } },
        { code: "53031010", name: "ค่าน้ำดื่ม", importantType: 'none', budgets: { "ผบง.": 5600, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53031020", name: "ค่าน้ำประปา", importantType: 'none', budgets: { "ผบง.": 27000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53032010", name: "ค่าใช้บริการโทรศัพท์", importantType: 'none', budgets: { "ผบง.": 20000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53032020", name: "ค่าบำรุงรักษาคู่สายโทรศัพท์", importantType: 'none', budgets: { "ผบง.": 15000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53032060", name: "ค่าไปรษณีย์โทรเลข", importantType: 'none', budgets: { "ผบง.": 15000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53032080", name: "ค่าใช้จ่ายในการใช้อินเตอร์เน็ต", importantType: 'none', budgets: { "ผบง.": 8400, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53034010", name: "ค่าจ้างเหมาทำความสะอาด", importantType: 'none', budgets: { "ผบง.": 220000, "กบห.": 0, "ผปร.": 26400, "ผบค.": 0 } },
        { code: "53034030", name: "ค่าจ้างบำรุงรักษาสวน", importantType: 'none', budgets: { "ผบง.": 72000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53034040", name: "ค่าบำรุงรักษาบริเวณสำนักงาน", importantType: 'none', budgets: { "ผบง.": 38000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53039010", name: "เชื้อเพลิงยานพาหนะ", importantType: 'operating', budgets: { "ผบง.": 92000, "กบห.": 97000, "ผปร.": 460000, "ผบค.": 155000 } },
        { code: "53039990", name: "ค่าใช้จ่ายเบ็ดเตล็ด", importantType: 'none', budgets: { "ผบง.": 15000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53051040", name: "ค่าซ่อมแซมบำรุงรักษา-อาคาร", importantType: 'none', budgets: { "ผบง.": 175000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53051050", name: "ค่าซ่อมแซมบำรุงรักษา-ยานพาหนะ", importantType: 'none', budgets: { "ผบง.": 10000, "กบห.": 0, "ผปร.": 140000, "ผบค.": 30000 } },
        { code: "53051060", name: "ค่าซ่อมแซมบำรุงรักษา-คอมฯ&อุปกรณ์ประกอบคอมฯ", importantType: 'none', budgets: { "ผบง.": 30000, "กบห.": 0, "ผปร.": 30000, "ผบค.": 30000 } },
        { code: "53051090", name: "ค่าวัสดุเบ็ดเตล็ด ด้านช่าง", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 15000, "ผบค.": 15000 } },
        { code: "53051100", name: "ค่าซ่อมแซมบำรุงรักษาอุปกรณ์ในสำนักงาน", importantType: 'none', budgets: { "ผบง.": 50000, "กบห.": 0, "ผปร.": 20000, "ผบค.": 20000 } },
        { code: "53051990", name: "ค่าซ่อมแซมบำรุงรักษาอื่น ๆ", importantType: 'none', budgets: { "ผบง.": 10000, "กบห.": 0, "ผปร.": 10000, "ผบค.": 10000 } },
        { code: "53062020", name: "ค่าเบี้ยประกัน-ยานพาหนะ", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 20000, "ผบค.": 0 } },
        { code: "53064010", name: "ค่าภาษีที่ดินฯ", importantType: 'none', budgets: { "ผบง.": 30000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53064020", name: "ค่าภาษีและค่าธรรมเนียมยานพาหนะ", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 30000, "ผบค.": 0 } },
        { code: "53069020", name: "ค่าขนส่งขนย้าย", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 1000, "ผบค.": 0 } },
        { code: "53069070", name: "ค่าธรรมเนียมธนาคาร", importantType: 'none', budgets: { "ผบง.": 9000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } },
        { code: "53069110", name: "ค่าตรวจสภาพยานพาหนะ", importantType: 'none', budgets: { "ผบง.": 0, "กบห.": 0, "ผปร.": 2500, "ผบค.": 0 } },
        { code: "53069990", name: "ค่าใช้จ่ายอื่น", importantType: 'none', budgets: { "ผบง.": 80000, "กบห.": 0, "ผปร.": 0, "ผบค.": 0 } }
    ];

    // Firebase Listeners
    const initFirebaseSync = () => {
        console.log('Initializing Firebase Sync...');
        // Sync Accounts
        onSnapshot(collection(db, 'accounts'), (snapshot) => {
            console.log('Accounts snapshot received, size:', snapshot.size);
            if (snapshot.empty) {
                console.log('Accounts collection is empty, performing initial migration...');
                // Initial migration: upload default accounts
                defaultAccountData.forEach(acc => {
                    setDoc(doc(db, 'accounts', acc.code), acc).catch(err => console.error('Error setting default account:', err));
                });
            } else {
                accountData = snapshot.docs.map(doc => doc.data() as Account);
                populateAccountDatalist();
                renderMgmtAccountList();
                updateSummary();
            }
        }, (error) => {
            console.error('Error in accounts snapshot:', error);
        });

        // Sync Disbursements
        onSnapshot(collection(db, 'disbursements'), (snapshot) => {
            console.log('Disbursements snapshot received, size:', snapshot.size);
            disbursements = snapshot.docs.map(doc => doc.data() as Disbursement);
            // Sort by voucher number descending primarily, then by date descending
            disbursements.sort((a, b) => {
                const vA = a.voucherNumber || '';
                const vB = b.voucherNumber || '';
                if (vA !== vB) {
                    return vB.localeCompare(vA, undefined, { numeric: true, sensitivity: 'base' });
                }
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            renderTable();
            updateSummary();
        }, (error) => {
            console.error('Error in disbursements snapshot:', error);
        });

        // Sync Users
        onSnapshot(collection(db, 'users'), (snapshot) => {
            console.log('Users snapshot received, size:', snapshot.size);
            if (snapshot.empty) {
                console.log('Users collection is empty, performing initial migration...');
                // Initial migration: upload default admin
                const defaultAdmin = { username: '9012844', password: 'PEATSG043', role: 'admin' };
                setDoc(doc(db, 'users', defaultAdmin.username), defaultAdmin).catch(err => console.error('Error setting default admin:', err));
            } else {
                users = snapshot.docs.map(doc => doc.data() as User);
                renderSuperAdminUserList();
            }
        }, (error) => {
            console.error('Error in users snapshot:', error);
        });
    };

    // UI Functions
    const populateAccountDatalist = () => {
        accountCodesDatalist.innerHTML = '';
        accountData.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.code;
            option.textContent = acc.name;
            accountCodesDatalist.appendChild(option);
        });
    };

    const updateBudgetInfo = () => {
        const code = accountCodeInput.value;
        const costCenter = costCenterInput.value;
        const currentId = disbursementIdInput.value;
        const currentPrice = parseFloat(priceInput.value) || 0;

        const account = accountData.find(acc => acc.code === code);
        
        if (account && costCenter && account.budgets[costCenter] !== undefined) {
            const allocated = account.budgets[costCenter];
            
            const spent = disbursements
                .filter(d => d.accountCode === code && d.costCenter === costCenter && d.id !== currentId)
                .reduce((sum, d) => sum + parseFloat(d.price), 0);
            
            const totalSpentWithCurrent = spent + currentPrice;
            const remaining = allocated - totalSpentWithCurrent;
            const usagePercent = allocated > 0 ? (totalSpentWithCurrent / allocated * 100) : 0;

            if (budgetAllocatedDisplay) budgetAllocatedDisplay.textContent = allocated.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (budgetRemainingDisplay) budgetRemainingDisplay.textContent = remaining.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (budgetProgress) {
                (budgetProgress as HTMLElement).style.width = `${Math.min(usagePercent, 100)}%`;
                if (usagePercent > 90) {
                    budgetProgress.className = 'bg-red-600 h-1.5 rounded-full';
                } else if (usagePercent > 70) {
                    budgetProgress.className = 'bg-yellow-600 h-1.5 rounded-full';
                } else {
                    budgetProgress.className = 'bg-indigo-600 h-1.5 rounded-full';
                }
            }
            if (budgetUsageText) budgetUsageText.textContent = `ใช้ไป ${usagePercent.toFixed(1)}%`;
            
            const currentUser = sessionStorage.getItem('currentUser');
            if (currentUser === '9012844' && budgetInfo) {
                budgetInfo.classList.remove('hidden');
            }
        } else {
            if (budgetInfo) budgetInfo.classList.add('hidden');
        }
    };

    const updateSummary = () => {
        const deptFilterValue = summaryDeptFilter.value;
        const currentYear = "2026"; // User requested image for 2026

        let filteredForTable = disbursements.filter(d => {
            const statusMatch = true;
            const deptMatch = deptFilterValue === 'all' || d.costCenter === deptFilterValue;
            return statusMatch && deptMatch;
        });

        let summaryData = [];
        let selectedPeriod = '';
        let summaryDisplayText = `ภาพรวมทั้งหมด ปี ${currentYear}`;

        if (summaryStartDate.value && summaryEndDate.value) {
            const start = summaryStartDate.value;
            const end = summaryEndDate.value;
            selectedPeriod = `${start}_to_${end}`;
            summaryData = filteredForTable.filter(d => d.date >= start && d.date <= end);
            summaryDisplayText = `ระหว่างวันที่ ${start} ถึง ${end}`;
        } else if (summaryMonth.value) {
            selectedPeriod = summaryMonth.value;
            summaryData = filteredForTable.filter(d => d.date.startsWith(selectedPeriod));
            summaryDisplayText = `ประจำเดือน ${selectedPeriod}`;
        } else {
            selectedPeriod = currentYear;
            summaryData = filteredForTable.filter(d => d.date.startsWith(selectedPeriod));
            summaryDisplayText = `ภาพรวมทั้งหมด ปี ${currentYear}`;
        }

        const total = summaryData.reduce((sum, d) => sum + parseFloat(d.price), 0);
        
        // Budget Summary Table Logic
        const budgetSummaryContainer = document.getElementById('budget-summary-container')!;
        const budgetSummaryBody = document.getElementById('budget-summary-body')!;
        const budgetSummaryTitle = document.getElementById('budget-summary-title')!;
        const budgetColAnnual = document.getElementById('budget-col-annual')!;
        const budgetColPeriod = document.getElementById('budget-col-period')!;
        const budgetColSpent = document.getElementById('budget-col-spent')!;
        const budgetColRemainingPeriod = document.getElementById('budget-col-remaining-period')!;
        const budgetColRemainingYear = document.getElementById('budget-col-remaining-year')!;
        
        if (selectedPeriod) {
            budgetSummaryContainer.classList.remove('hidden');
            budgetSummaryBody.innerHTML = '';

            budgetSummaryTitle.textContent = `สรุปงบประมาณรายบัญชี (${summaryDisplayText})`;
            budgetColAnnual.textContent = 'งบประมาณรวม/ปี';
            
            if (summaryMonth.value && !summaryStartDate.value) {
                budgetColPeriod.innerHTML = 'งบประมาณ/เดือน<br><span class="text-[9px]">(คิดเป็น 70% ของงบประมาณที่ได้รับ)</span>';
                budgetColSpent.textContent = 'เบิกจ่าย (เดือนนี้)';
                budgetColRemainingPeriod.textContent = 'คงเหลือ/เดือน';
            } else if (summaryStartDate.value && summaryEndDate.value) {
                 budgetColPeriod.innerHTML = 'งบประมาณ (ช่วงที่เลือก)<br><span class="text-[9px]">(คิดเป็น 70% ของงบประมาณที่ได้รับ)</span>';
                 budgetColSpent.textContent = 'เบิกจ่าย (ช่วงนี้)';
                 budgetColRemainingPeriod.textContent = 'คงเหลือ (ช่วงนี้)';
            } else {
                budgetColPeriod.innerHTML = 'งบประมาณ/ปี<br><span class="text-[9px]">(คิดเป็น 70% ของงบประมาณที่ได้รับ)</span>';
                budgetColSpent.textContent = 'เบิกจ่ายสะสม';
                budgetColRemainingPeriod.textContent = 'คงเหลือสะสม';
            }
            
            budgetColRemainingYear.textContent = 'คงเหลือ/ปี';

            let allRelevantCodes = [...new Set(summaryData.map(d => d.accountCode))].filter(c => c);

            allRelevantCodes.forEach(code => {
                const account = accountData.find(a => a.code === code);
                if (!account) return;

                let annualBudgetForDept = 0;
                if (deptFilterValue === 'all') {
                    annualBudgetForDept = Object.values(account.budgets).reduce((sum, b) => sum + b, 0);
                } else {
                    annualBudgetForDept = account.budgets[deptFilterValue] || 0;
                }

                let annualBudgetDisplay = annualBudgetForDept;
                let periodBudgetDisplay = 0;
                
                if (summaryMonth.value && !summaryStartDate.value) {
                    periodBudgetDisplay = (annualBudgetForDept / 12) * 0.70;
                } else if (summaryStartDate.value && summaryEndDate.value) {
                    // Approximate budget for range (days/365)
                    const start = new Date(summaryStartDate.value);
                    const end = new Date(summaryEndDate.value);
                    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    periodBudgetDisplay = (annualBudgetForDept * (days / 365)) * 0.70;
                } else {
                    periodBudgetDisplay = annualBudgetForDept * 0.70;
                }

                const periodSpent = summaryData
                    .filter(d => d.accountCode === code)
                    .reduce((sum, d) => sum + parseFloat(d.price), 0);

                let totalSpentYear = 0;
                const filterYear = currentYear;
                totalSpentYear = disbursements
                    .filter(d => {
                        const codeMatch = d.accountCode === code;
                        const yearMatch = d.date.startsWith(filterYear);
                        const deptMatch = deptFilterValue === 'all' || d.costCenter === deptFilterValue;
                        return codeMatch && yearMatch && deptMatch;
                    })
                    .reduce((sum, d) => sum + parseFloat(d.price), 0);


                const remainingPeriod = periodBudgetDisplay - periodSpent;
                const remainingYear = annualBudgetForDept - totalSpentYear;
                const isOverThreshold = periodSpent > periodBudgetDisplay;

                const row = document.createElement('tr');
                row.className = isOverThreshold ? 'bg-red-50' : '';
                row.innerHTML = `
                    <td class="px-3 py-2 whitespace-nowrap">
                        <div class="font-medium text-gray-900">${code}</div>
                        <div class="text-[10px] text-gray-500 truncate max-w-[120px]">${account.name}</div>
                    </td>
                    <td class="px-3 py-2 text-right whitespace-nowrap">${annualBudgetDisplay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="px-3 py-2 text-right whitespace-nowrap">${periodBudgetDisplay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="px-3 py-2 text-right whitespace-nowrap font-medium ${isOverThreshold ? 'text-red-600' : ''}">${periodSpent.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="px-3 py-2 text-right whitespace-nowrap font-medium ${remainingPeriod < 0 ? 'text-red-600' : 'text-gray-700'}">${remainingPeriod.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="px-3 py-2 text-right whitespace-nowrap font-medium ${remainingYear < 0 ? 'text-red-600' : 'text-gray-700'}">${remainingYear.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                `;
                budgetSummaryBody.appendChild(row);
            });

            if (budgetSummaryBody.innerHTML === '') {
                budgetSummaryBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">ไม่มีข้อมูลรหัสบัญชี</td></tr>';
            }
        } else {
            budgetSummaryContainer.classList.add('hidden');
        }
    };

    const renderImportantAccountsReport = () => {
        // Removed
    };

    const openAttachment = (dataUrl: string, filename: string) => {
        if (!dataUrl) return;
        
        // If it's a regular URL, just open it
        if (!dataUrl.startsWith('data:')) {
            window.open(dataUrl, '_blank');
            return;
        }

        try {
            // Convert Data URL to Blob for better mobile support
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const url = URL.createObjectURL(blob);
            
            // Create a temporary link to open the blob
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.error('Error opening attachment:', e);
            // Fallback
            window.open(dataUrl, '_blank');
        }
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const searchQuery = (tableSearch?.value || '').toLowerCase().trim();
        
        const filteredAll = disbursements.filter(d => {
            if (!searchQuery) return true;
            
            const thaiDate = d.date.split('-').reverse().join('/');
            const searchTerms = [
                d.date,
                thaiDate,
                d.accountCode,
                d.accountName,
                d.costCenter,
                d.wbs,
                d.description,
                d.payee,
                d.voucherNumber,
                d.chequeNumber
            ].filter(v => v).map(v => v!.toString().toLowerCase());

            return searchTerms.some(term => term.includes(searchQuery));
        });

        // Pagination Logic
        const totalItems = filteredAll.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Ensure currentPage is valid
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const filteredData = filteredAll.slice(startIndex, endIndex);

        if (totalItems === 0) {
            const colspan = sessionStorage.getItem('userRole') === 'admin' ? 8 : 7;
            tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-10 text-gray-500">ไม่พบรายการ</td></tr>`;
            updatePaginationUI(0, 0, 0, 0);
            return;
        }

        filteredData.forEach(d => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${d.date}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-indigo-600 font-medium">${d.voucherNumber || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 font-medium">${d.accountCode || '-'}</div>
                    <div class="text-xs text-gray-500">${d.costCenter || '-'}</div>
                    ${d.wbs ? `<div class="text-[10px] text-indigo-600 font-medium mt-1">WBS: ${d.wbs}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 font-medium">${d.description}</div>
                    <div class="text-xs text-gray-500">${d.accountName || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${d.payee}</div>
                    <div class="text-xs text-gray-500">
                        ${d.paymentMethod}
                        ${d.paymentMethod === 'เช็ค' && d.chequeNumber ? `<span class="text-indigo-600 ml-1">#${d.chequeNumber}</span>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${parseFloat(d.netTotal).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${d.attachment ? `<button class="view-attachment-btn text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1" data-id="${d.id}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4"/><path d="M10 16h4"/><path d="M12 10v6"/></svg> <span>ดูไฟล์</span></button>` : 'ไม่มี'}
                </td>
                ${sessionStorage.getItem('userRole') === 'admin' ? `
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="edit-btn text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1" data-id="${d.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        <span>แก้ไข</span>
                    </button>
                    <button class="delete-btn text-red-600 hover:text-red-900 ml-4 inline-flex items-center space-x-1" data-id="${d.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        <span>ลบ</span>
                    </button>
                </td>
                ` : ''}
            `;
            tableBody.appendChild(row);
        });

        updatePaginationUI(startIndex + 1, endIndex, totalItems, totalPages);
    };

    const updatePaginationUI = (start: number, end: number, total: number, totalPages: number) => {
        const pStart = document.getElementById('pagination-start')!;
        const pEnd = document.getElementById('pagination-end')!;
        const pTotal = document.getElementById('pagination-total')!;
        const pNumbers = document.getElementById('pagination-numbers')!;
        const prevMobile = document.getElementById('prev-page-mobile') as HTMLButtonElement;
        const nextMobile = document.getElementById('next-page-mobile') as HTMLButtonElement;

        pStart.textContent = start.toString();
        pEnd.textContent = end.toString();
        pTotal.textContent = total.toString();

        prevMobile.disabled = currentPage === 1;
        nextMobile.disabled = currentPage === totalPages || totalPages === 0;

        pNumbers.innerHTML = '';
        
        if (totalPages <= 1) return;

        // Previous Button
        const prevBtn = document.createElement('button');
        prevBtn.className = `relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50`;
        prevBtn.disabled = currentPage === 1;
        prevBtn.innerHTML = '<svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" /></svg>';
        prevBtn.onclick = () => { currentPage--; renderTable(); };
        pNumbers.appendChild(prevBtn);

        // Page Numbers Logic (showing a window of pages)
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            const isActive = i === currentPage;
            pageBtn.className = isActive 
                ? 'relative z-10 inline-flex items-center bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0';
            pageBtn.textContent = i.toString();
            pageBtn.onclick = () => { currentPage = i; renderTable(); };
            pNumbers.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.className = `relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50`;
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.innerHTML = '<svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
        nextBtn.onclick = () => { currentPage++; renderTable(); };
        pNumbers.appendChild(nextBtn);

        // Mobile Handlers
        prevMobile.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
        nextMobile.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
    };

    const applyPermissions = () => {
        const role = sessionStorage.getItem('userRole');
        const currentUser = sessionStorage.getItem('currentUser');
        const adminElements = document.querySelectorAll('.admin-only');
        const superAdminElements = document.querySelectorAll('.super-admin-only');
        const mainGrid = document.getElementById('main-grid')!;
        const tableColumn = document.getElementById('table-column')!;

        if (role === 'guest') {
            adminElements.forEach(el => el.classList.add('hidden'));
            superAdminElements.forEach(el => el.classList.add('hidden'));
            mainGrid.classList.remove('lg:grid-cols-3');
            mainGrid.classList.add('lg:grid-cols-1');
            tableColumn.classList.remove('lg:col-span-2');
        } else {
            adminElements.forEach(el => el.classList.remove('hidden'));
            if (currentUser === '9012844') {
                superAdminElements.forEach(el => el.classList.remove('hidden'));
            } else {
                superAdminElements.forEach(el => el.classList.add('hidden'));
            }
            mainGrid.classList.add('lg:grid-cols-3');
            mainGrid.classList.remove('lg:grid-cols-1');
            tableColumn.classList.add('lg:col-span-2');
        }
        renderTable();
    };

    const showApp = () => {
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        applyPermissions();
    };

    const showLogin = () => {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    };

    // Event Listeners
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (users.length === 0) {
            loginError.textContent = 'กำลังเชื่อมต่อกับเซิร์ฟเวอร์ กรุณารอสักครู่...';
            loginError.classList.remove('hidden');
            return;
        }

        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            console.log('Login successful for user:', username);
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', username);
            sessionStorage.setItem('userRole', user.role || 'admin');
            showApp();
            loginError.classList.add('hidden');
        } else {
            console.log('Login failed for user:', username);
            loginError.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            loginError.classList.remove('hidden');
        }
    });

    guestLoginBtn.addEventListener('click', () => {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', 'guest');
        sessionStorage.removeItem('currentUser');
        showApp();
    });

    const headerLogoutBtn = document.getElementById('header-logout-btn')!;
    headerLogoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        showLogin();
    });

    const calculateAmounts = () => {
        const price = parseFloat(priceInput.value) || 0;
        const tax = parseFloat(taxInput.value) || 0;
        const wht = parseFloat(whtInput.value) || 0;

        const totalWithVat = price + (price * tax / 100);
        const whtAmount = price * wht / 100;
        const netTotal = totalWithVat - whtAmount;

        totalPriceInput.value = totalWithVat.toFixed(2);
        netTotalInput.value = netTotal.toFixed(2);
        updateBudgetInfo();
    };

    priceInput.addEventListener('input', calculateAmounts);
    taxInput.addEventListener('input', calculateAmounts);
    whtInput.addEventListener('input', calculateAmounts);

    accountCodeInput.addEventListener('input', () => {
        const code = accountCodeInput.value;
        const account = accountData.find(acc => acc.code === code);
        if (account) {
            accountNameInput.value = account.name;
        } else {
            accountNameInput.value = '';
        }
        updateBudgetInfo();
    });

    costCenterInput.addEventListener('change', updateBudgetInfo);

    paymentMethodInput.addEventListener('change', () => {
        if (paymentMethodInput.value === 'เช็ค') {
            chequeNumberContainer.classList.remove('hidden');
        } else {
            chequeNumberContainer.classList.add('hidden');
            chequeNumberInput.value = '';
        }
    });

    const resetForm = () => {
        form.reset();
        disbursementIdInput.value = '';
        wbsContainer.classList.add('hidden');
        accountDetailsContainer.classList.add('hidden');
        accountCodeInput.required = false;
        costCenterInput.required = false;
        wbsInput.required = false;
        totalPriceInput.value = '';
        netTotalInput.value = '';
        attachmentInput.value = '';
        attachmentUrlInput.value = '';
        voucherNumberInput.value = '';
        chequeNumberInput.value = '';
        chequeNumberContainer.classList.add('hidden');
        attachmentNameDisplay.textContent = '';
        attachmentContainer.classList.remove('hidden');
        attachmentFileDiv.classList.remove('hidden');
        attachmentLinkDiv.classList.add('hidden');
        (document.querySelector('input[name="attachment-type"][value="file"]') as HTMLInputElement).checked = true;
        if (budgetInfo) budgetInfo.classList.add('hidden');
        formTitle.textContent = 'บันทึกข้อมูล';
        submitBtn.textContent = 'บันทึก';
        cancelBtn.style.display = 'none';
    };

    const handleAttachmentTypeChange = () => {
        const selectedType = (document.querySelector('input[name="attachment-type"]:checked') as HTMLInputElement).value;
        if (selectedType === 'file') {
            attachmentFileDiv.classList.remove('hidden');
            attachmentLinkDiv.classList.add('hidden');
            attachmentUrlInput.value = '';
        } else {
            attachmentFileDiv.classList.add('hidden');
            attachmentLinkDiv.classList.remove('hidden');
            attachmentInput.value = '';
            attachmentNameDisplay.textContent = '';
        }
    };

    attachmentTypeRadios.forEach(radio => radio.addEventListener('change', handleAttachmentTypeChange));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = disbursementIdInput.value || Date.now().toString();
        const existingDisbursement = disbursements.find(d => d.id === id);

        let finalAttachmentData = null;
        let finalAttachmentName = null;

        const file = attachmentInput.files?.[0];
        const attachmentType = (document.querySelector('input[name="attachment-type"]:checked') as HTMLInputElement).value;
        const attachmentUrl = attachmentUrlInput.value.trim();

        if (attachmentType === 'file' && file) {
            if (file.type !== 'application/pdf') {
                alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
                return;
            }
            if (file.size > 700 * 1024) {
                alert('เนื่องจากข้อจำกัดของระบบฐานข้อมูล ไฟล์แนบต้องมีขนาดไม่เกิน 700 KB ต่อ 1 รายการ\nกรุณาลดขนาดไฟล์ PDF หรือแยกรายการบันทึก');
                return;
            }
            finalAttachmentData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = event => resolve(event.target?.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
            finalAttachmentName = file.name;
        } else if (attachmentType === 'link' && attachmentUrl) {
            finalAttachmentData = attachmentUrl;
            finalAttachmentName = 'ลิงก์ภายนอก';
        } else if (existingDisbursement) {
            finalAttachmentData = existingDisbursement.attachment;
            finalAttachmentName = existingDisbursement.attachmentName;
        }

        const disbursementData: Disbursement = {
            id: id,
            budgetSource: budgetSourceInput.value,
            wbs: budgetSourceInput.value === 'หมายเลขงาน' ? wbsInput.value : undefined,
            accountCode: accountCodeInput.value,
            accountName: accountNameInput.value,
            costCenter: costCenterInput.value,
            date: (document.getElementById('date') as HTMLInputElement).value,
            voucherNumber: voucherNumberInput.value,
            description: (document.getElementById('description') as HTMLInputElement).value,
            price: priceInput.value,
            tax: taxInput.value,
            totalPrice: totalPriceInput.value,
            wht: whtInput.value,
            netTotal: netTotalInput.value,
            payee: (document.getElementById('payee') as HTMLInputElement).value,
            paymentMethod: paymentMethodInput.value,
            chequeNumber: paymentMethodInput.value === 'เช็ค' ? chequeNumberInput.value : '',
            attachment: finalAttachmentData as string | null,
            attachmentName: finalAttachmentName,
            createdAt: existingDisbursement?.createdAt || serverTimestamp()
        };

        try {
            console.log('Saving disbursement:', id);
            await setDoc(doc(db, 'disbursements', id), disbursementData);
            console.log('Disbursement saved successfully');
            resetForm();
            alert('บันทึกข้อมูลสำเร็จ');
        } catch (error) {
            console.error('Error saving disbursement:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    });

    const deleteConfirmModal = document.getElementById('delete-confirm-modal')!;
    const deleteConfirmMessage = document.getElementById('delete-confirm-message')!;
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn')!;
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn')!;
    let deleteAction: (() => void) | null = null;

    const showDeleteConfirm = (message: string, action: () => void) => {
        deleteConfirmMessage.textContent = message;
        deleteAction = action;
        deleteConfirmModal.classList.remove('hidden');
    };

    confirmDeleteBtn.addEventListener('click', () => {
        if (deleteAction) {
            deleteAction();
            deleteConfirmModal.classList.add('hidden');
            deleteAction = null;
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteConfirmModal.classList.add('hidden');
        deleteAction = null;
    });

    tableBody.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest('.edit-btn') as HTMLElement;
        const viewAttachmentBtn = target.closest('.view-attachment-btn') as HTMLElement;

        if (viewAttachmentBtn) {
            const id = viewAttachmentBtn.dataset.id;
            const disbursement = disbursements.find(d => d.id === id);
            if (disbursement && disbursement.attachment) {
                openAttachment(disbursement.attachment, disbursement.attachmentName || 'attachment.pdf');
            }
            return;
        }

        if (editBtn) {
            const id = editBtn.dataset.id;
            const disbursement = disbursements.find(d => d.id === id);
            if (!disbursement) return;

            disbursementIdInput.value = disbursement.id;
            budgetSourceInput.value = disbursement.budgetSource || '';
            
            // Toggle containers based on budget source
            if (disbursement.budgetSource === 'ต้นสังกัด') {
                accountDetailsContainer.classList.remove('hidden');
                wbsContainer.classList.add('hidden');
                accountCodeInput.required = true;
                costCenterInput.required = true;
                wbsInput.required = false;
            } else if (disbursement.budgetSource === 'หมายเลขงาน') {
                accountDetailsContainer.classList.add('hidden');
                wbsContainer.classList.remove('hidden');
                accountCodeInput.required = false;
                costCenterInput.required = false;
                wbsInput.required = true;
                wbsInput.value = disbursement.wbs || '';
            } else {
                accountDetailsContainer.classList.add('hidden');
                wbsContainer.classList.add('hidden');
                accountCodeInput.required = false;
                costCenterInput.required = false;
                wbsInput.required = false;
            }

            accountCodeInput.value = disbursement.accountCode || '';
            accountNameInput.value = disbursement.accountName || '';
            costCenterInput.value = disbursement.costCenter || '';
            (document.getElementById('date') as HTMLInputElement).value = disbursement.date;
            voucherNumberInput.value = disbursement.voucherNumber || '';
            (document.getElementById('description') as HTMLInputElement).value = disbursement.description;
            priceInput.value = disbursement.price;
            taxInput.value = disbursement.tax;
            whtInput.value = disbursement.wht;
            calculateAmounts();
            updateBudgetInfo();
            (document.getElementById('payee') as HTMLInputElement).value = disbursement.payee;
            paymentMethodInput.value = disbursement.paymentMethod;
            
            if (disbursement.paymentMethod === 'เช็ค') {
                chequeNumberContainer.classList.remove('hidden');
                chequeNumberInput.value = disbursement.chequeNumber || '';
            } else {
                chequeNumberContainer.classList.add('hidden');
                chequeNumberInput.value = '';
            }
            
            if (disbursement.attachment) {
                if (disbursement.attachment.startsWith('data:')) {
                    (document.querySelector('input[name="attachment-type"][value="file"]') as HTMLInputElement).checked = true;
                    attachmentNameDisplay.textContent = disbursement.attachmentName ? `ไฟล์ปัจจุบัน: ${disbursement.attachmentName}` : '';
                    attachmentUrlInput.value = '';
                } else {
                    (document.querySelector('input[name="attachment-type"][value="link"]') as HTMLInputElement).checked = true;
                    attachmentUrlInput.value = disbursement.attachment;
                    attachmentNameDisplay.textContent = '';
                }
            } else {
                (document.querySelector('input[name="attachment-type"][value="file"]') as HTMLInputElement).checked = true;
                attachmentNameDisplay.textContent = '';
                attachmentUrlInput.value = '';
            }
            handleAttachmentTypeChange();
            attachmentInput.value = '';

            formTitle.textContent = 'แก้ไขรายการ';
            submitBtn.textContent = 'อัปเดต';
            cancelBtn.style.display = 'inline-flex';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        const deleteBtn = target.closest('.delete-btn') as HTMLElement;
        if (deleteBtn) {
            const id = deleteBtn.dataset.id!;
            showDeleteConfirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?', async () => {
                await deleteDoc(doc(db, 'disbursements', id));
            });
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    budgetSourceInput.addEventListener('change', () => {
        if (budgetSourceInput.value === 'ต้นสังกัด') {
            accountDetailsContainer.classList.remove('hidden');
            wbsContainer.classList.add('hidden');
            accountCodeInput.required = true;
            costCenterInput.required = true;
            wbsInput.required = false;
        } else if (budgetSourceInput.value === 'หมายเลขงาน') {
            accountDetailsContainer.classList.add('hidden');
            wbsContainer.classList.remove('hidden');
            accountCodeInput.required = false;
            costCenterInput.required = false;
            wbsInput.required = true;
            // Clear other fields
            accountCodeInput.value = '';
            accountNameInput.value = '';
            costCenterInput.value = '';
            if (budgetInfo) budgetInfo.classList.add('hidden');
        } else {
            accountDetailsContainer.classList.add('hidden');
            wbsContainer.classList.add('hidden');
            accountCodeInput.required = false;
            costCenterInput.required = false;
            wbsInput.required = false;
            // Clear all
            accountCodeInput.value = '';
            accountNameInput.value = '';
            costCenterInput.value = '';
            wbsInput.value = '';
            if (budgetInfo) budgetInfo.classList.add('hidden');
        }
    });

    // Add search listener
    tableSearch.addEventListener('input', () => {
        currentPage = 1;
        renderTable();
    });

    summaryDeptFilter.addEventListener('change', updateSummary);
    summaryMonth.addEventListener('input', () => {
        // If month is changed, clear range to avoid confusion
        summaryStartDate.value = '';
        summaryEndDate.value = '';
        updateSummary();
    });
    summaryStartDate.addEventListener('input', () => {
        summaryMonth.value = '';
        updateSummary();
    });
    summaryEndDate.addEventListener('input', () => {
        summaryMonth.value = '';
        updateSummary();
    });

    const exportToCsv = (filename: string, header: string[], rows: any[][]) => {
        const csvContent = [header.join(','), ...rows.map(row => 
            row.map(cell => `"${(cell === null || cell === undefined) ? '' : cell.toString().replace(/"/g, '""')}"`).join(',')
        )].join('\n');

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    exportRecordedDataBtn.addEventListener('click', () => {
        const searchQuery = (tableSearch?.value || '').toLowerCase().trim();
        const dataToExport = disbursements.filter(d => {
            if (!searchQuery) return true;
            const thaiDate = d.date.split('-').reverse().join('/');
            const searchTerms = [
                d.date, thaiDate, d.accountCode, d.accountName, d.costCenter, d.description, 
                d.payee, d.voucherNumber, d.chequeNumber
            ].filter(v => v).map(v => v!.toString().toLowerCase());
            return searchTerms.some(term => term.includes(searchQuery));
        });
        
        const header = ["วันที่", "เลขที่ใบสำคัญจ่าย", "รหัสบัญชี", "ชื่อบัญชี", "ศูนย์ต้นทุน", "รายละเอียด", "ราคา", "ภาษี (%)", "ราคารวม VAT", "หัก ณ ที่จ่าย (%)", "ยอดสุทธิ", "ผู้รับเงิน", "รูปแบบการจ่าย", "เลขที่เช็ค"];
        const rows = dataToExport.map(row => [
            row.date,
            row.voucherNumber || '',
            row.accountCode || '',
            row.accountName || '',
            row.costCenter || '',
            row.description,
            row.price,
            row.tax,
            row.totalPrice,
            row.wht,
            row.netTotal,
            row.payee,
            row.paymentMethod,
            row.chequeNumber || ''
        ]);
        
        exportToCsv('recorded_data.csv', header, rows);
    });

    exportDisbursementSummaryBtn.addEventListener('click', () => {
        const deptFilterValue = summaryDeptFilter.value;
        const currentYear = "2026";

        let summaryData = [];
        let periodLabel = '';

        const deptMatchFn = (d: Disbursement) => deptFilterValue === 'all' || d.costCenter === deptFilterValue;

        if (summaryStartDate.value && summaryEndDate.value) {
            const start = summaryStartDate.value;
            const end = summaryEndDate.value;
            periodLabel = `range_${start}_to_${end}`;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date >= start && d.date <= end);
        } else if (summaryMonth.value) {
            periodLabel = summaryMonth.value;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date.startsWith(periodLabel));
        } else {
            periodLabel = `year_${currentYear}`;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date.startsWith(currentYear));
        }

        const header = ["วันที่", "เลขที่ใบสำคัญจ่าย", "รหัสบัญชี", "ชื่อบัญชี", "ศูนย์ต้นทุน", "รายละเอียด", "ราคา", "ภาษี (%)", "ราคารวม VAT", "หัก ณ ที่จ่าย (%)", "ยอดสุทธิ", "ผู้รับเงิน", "รูปแบบการจ่าย"];
        const rows = summaryData.map(row => [
            row.date,
            row.voucherNumber || '',
            row.accountCode || '',
            row.accountName || '',
            row.costCenter || '',
            row.description,
            row.price,
            row.tax,
            row.totalPrice,
            row.wht,
            row.netTotal,
            row.payee,
            row.paymentMethod
        ]);

        exportToCsv(`disbursement_summary_${periodLabel}.csv`, header, rows);
    });

    exportBudgetSummaryBtn.addEventListener('click', () => {
        const deptFilterValue = summaryDeptFilter.value;
        const currentYear = "2026";
        
        let summaryData = [];
        let selectedPeriod = '';
        let isMonthly = false;
        let isRange = false;

        const deptMatchFn = (d: Disbursement) => deptFilterValue === 'all' || d.costCenter === deptFilterValue;

        if (summaryStartDate.value && summaryEndDate.value) {
            const start = summaryStartDate.value;
            const end = summaryEndDate.value;
            isRange = true;
            selectedPeriod = `ช่วง_${start}_ถึง_${end}`;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date >= start && d.date <= end);
        } else if (summaryMonth.value) {
            isMonthly = true;
            selectedPeriod = summaryMonth.value;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date.startsWith(selectedPeriod));
        } else {
            selectedPeriod = currentYear;
            summaryData = disbursements.filter(d => deptMatchFn(d) && d.date.startsWith(selectedPeriod));
        }

        const header = ["รหัสบัญชี", "ชื่อบัญชี", "งบประมาณรวม/ปี", isMonthly ? "งบประมาณ (70%)" : isRange ? "งบประมาณ (70%)" : "งบประมาณ/ปี (70%)", isMonthly ? "เบิกจ่าย (เดือนนี้)" : isRange ? "เบิกจ่าย (ช่วงนี้)" : "เบิกจ่าย (ทั้งปี)", "คงเหลือสะสม", "คงเหลือ/ปี"];
        
        const allRelevantCodes = [...new Set(summaryData.map(d => d.accountCode))].filter(c => c);

        const rows = allRelevantCodes.map(code => {
            const account = accountData.find(a => a.code === code);
            if (!account) return null;

            let annualBudgetForDept = 0;
            if (deptFilterValue === 'all') {
                annualBudgetForDept = Object.values(account.budgets).reduce((sum, b) => sum + b, 0);
            } else {
                annualBudgetForDept = account.budgets[deptFilterValue] || 0;
            }

            let periodBudgetDisplay = 0;
            if (isMonthly) {
                periodBudgetDisplay = (annualBudgetForDept / 12) * 0.70;
            } else if (isRange) {
                const start = new Date(summaryStartDate.value);
                const end = new Date(summaryEndDate.value);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                periodBudgetDisplay = (annualBudgetForDept * (days / 365)) * 0.70;
            } else {
                periodBudgetDisplay = annualBudgetForDept * 0.70;
            }

            const periodSpent = summaryData
                .filter(d => d.accountCode === code)
                .reduce((sum, d) => sum + parseFloat(d.price), 0);

            const totalSpentYear = disbursements
                .filter(d => d.accountCode === code && d.date.startsWith(currentYear) && deptMatchFn(d))
                .reduce((sum, d) => sum + parseFloat(d.price), 0);

            return [
                code,
                account.name,
                annualBudgetForDept,
                periodBudgetDisplay,
                periodSpent,
                periodBudgetDisplay - periodSpent,
                annualBudgetForDept - totalSpentYear
            ];
        }).filter(r => r !== null);

        exportToCsv(`budget_summary_${selectedPeriod}.csv`, header, rows as any[][]);
    });

    // Settings Modal Logic
    const settingsBtn = document.getElementById('settings-btn')!;
    const settingsModal = document.getElementById('settings-modal')!;
    const closeSettingsBtn = document.getElementById('close-settings-btn')!;
    const logoutBtn = document.getElementById('logout-btn')!;
    const changePasswordForm = document.getElementById('change-password-form') as HTMLFormElement;
    const addUserForm = document.getElementById('add-user-form') as HTMLFormElement;

    settingsBtn.addEventListener('click', () => {
        applyPermissions();
        const currentUser = sessionStorage.getItem('currentUser');
        if (currentUser === '9012844') {
            renderSuperAdminUserList();
        }
        settingsModal.classList.remove('hidden');
    });

    const renderSuperAdminUserList = () => {
        const userListEl = document.getElementById('super-admin-user-list')!;
        userListEl.innerHTML = '';
        
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2 font-medium">${user.username}</td>
                <td class="px-4 py-2">
                    <input type="text" class="super-admin-password-input border rounded px-2 py-1 w-full" value="${user.password}" data-index="${index}">
                </td>
                <td class="px-4 py-2 text-center">
                    <button class="super-admin-save-btn text-green-600 hover:text-green-900 font-medium" data-index="${index}">บันทึก</button>
                    ${user.username !== '9012844' ? `<button class="super-admin-delete-btn text-red-600 hover:text-red-900 ml-2 font-medium" data-index="${index}">ลบ</button>` : ''}
                </td>
            `;
            userListEl.appendChild(row);
        });
    };

    document.getElementById('super-admin-user-list')!.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const index = parseInt(target.dataset.index!);

        if (target.classList.contains('super-admin-save-btn')) {
            const passwordInput = document.querySelector(`.super-admin-password-input[data-index="${index}"]`) as HTMLInputElement;
            const user = users[index];
            await updateDoc(doc(db, 'users', user.username), { password: passwordInput.value });
            alert('บันทึกรหัสผ่านใหม่สำเร็จ');
        } else if (target.classList.contains('super-admin-delete-btn')) {
            const user = users[index];
            showDeleteConfirm(`ยืนยันการลบผู้ใช้ ${user.username}?`, async () => {
                await deleteDoc(doc(db, 'users', user.username));
            });
        }
    });

    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        showLogin();
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentUser = sessionStorage.getItem('currentUser')!;
        const currentPassword = (document.getElementById('current-password') as HTMLInputElement).value;
        const newPassword = (document.getElementById('new-password') as HTMLInputElement).value;
        const feedbackEl = document.getElementById('password-change-feedback')!;

        const user = users.find(u => u.username === currentUser);

        if (!user || user.password !== currentPassword) {
            feedbackEl.textContent = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
            feedbackEl.className = 'text-red-500 text-sm text-center mt-2';
            return;
        }

        await updateDoc(doc(db, 'users', currentUser), { password: newPassword });
        feedbackEl.textContent = 'เปลี่ยนรหัสผ่านสำเร็จแล้ว';
        feedbackEl.className = 'text-green-600 text-sm text-center mt-2';
        changePasswordForm.reset();
    });

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUsername = (document.getElementById('new-username') as HTMLInputElement).value;
        const newUserPassword = (document.getElementById('new-user-password') as HTMLInputElement).value;
        const feedbackEl = document.getElementById('add-user-feedback')!;

        if (users.some(u => u.username === newUsername)) {
            feedbackEl.textContent = 'ชื่อผู้ใช้นี้มีอยู่แล้ว';
            feedbackEl.className = 'text-red-500 text-sm text-center mt-2';
            return;
        }

        await setDoc(doc(db, 'users', newUsername), { username: newUsername, password: newUserPassword, role: 'admin' });
        feedbackEl.textContent = 'เพิ่มผู้ใช้งานสำเร็จแล้ว';
        feedbackEl.className = 'text-green-600 text-sm text-center mt-2';
        addUserForm.reset();
    });



    // Account Management Logic
    const accountMgmtForm = document.getElementById('account-mgmt-form') as HTMLFormElement;
    const mgmtAccountIndex = document.getElementById('mgmt-account-index') as HTMLInputElement;
    const mgmtAccountCode = document.getElementById('mgmt-account-code') as HTMLInputElement;
    const mgmtAccountName = document.getElementById('mgmt-account-name') as HTMLInputElement;
    const mgmtAccountImportantType = document.getElementById('mgmt-account-important-type') as HTMLSelectElement;
    const mgmtBudgetผบง = document.getElementById('mgmt-budget-ผบง') as HTMLInputElement;
    const mgmtBudgetกบห = document.getElementById('mgmt-budget-กบห') as HTMLInputElement;
    const mgmtBudgetผปร = document.getElementById('mgmt-budget-ผปร') as HTMLInputElement;
    const mgmtBudgetผบค = document.getElementById('mgmt-budget-ผบค') as HTMLInputElement;
    const mgmtAccountSubmit = document.getElementById('mgmt-account-submit')!;
    const mgmtAccountCancel = document.getElementById('mgmt-account-cancel')!;
    const mgmtAccountList = document.getElementById('mgmt-account-list')!;

    const renderMgmtAccountList = () => {
        mgmtAccountList.innerHTML = '';
        accountData.forEach((acc, index) => {
            const totalBudget = Object.values(acc.budgets).reduce((sum, b) => sum + b, 0);
            
            let importantBadge = '';
            if (acc.importantType === 'operating') {
                importantBadge = '<span class="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">ดำเนินงาน</span>';
            } else if (acc.importantType === '7categories') {
                importantBadge = '<span class="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">7 ประเภท</span>';
            } else if (acc.importantType === 'both') {
                importantBadge = '<span class="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">ดำเนินงาน & 7 ประเภท</span>';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2 text-center font-medium text-gray-900">${index + 1}</td>
                <td class="px-4 py-2 font-medium">
                    <div class="flex items-center">
                        ${acc.code}
                        ${importantBadge}
                    </div>
                </td>
                <td class="px-4 py-2 truncate max-w-[150px]">${acc.name}</td>
                <td class="px-4 py-2 text-right">${totalBudget.toLocaleString()}</td>
                <td class="px-4 py-2 text-center space-x-2">
                    <button class="edit-acc-btn text-indigo-600 hover:text-indigo-900" data-index="${index}">แก้ไข</button>
                    <button class="delete-acc-btn text-red-600 hover:text-red-900" data-index="${index}">ลบ</button>
                </td>
            `;
            mgmtAccountList.appendChild(row);
        });
    };

    const resetMgmtForm = () => {
        accountMgmtForm.reset();
        mgmtAccountImportantType.value = "none";
        mgmtAccountIndex.value = "-1";
        mgmtAccountSubmit.textContent = "บันทึกรหัสบัญชี";
        mgmtAccountCancel.classList.add('hidden');
    };

    accountMgmtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const index = parseInt(mgmtAccountIndex.value);
        const code = mgmtAccountCode.value;
        const newAccount: Account = {
            code: code,
            name: mgmtAccountName.value,
            importantType: mgmtAccountImportantType.value as any,
            budgets: {
                "ผบง.": parseFloat(mgmtBudgetผบง.value) || 0,
                "กบห.": parseFloat(mgmtBudgetกบห.value) || 0,
                "ผปร.": parseFloat(mgmtBudgetผปร.value) || 0,
                "ผบค.": parseFloat(mgmtBudgetผบค.value) || 0
            }
        };

        await setDoc(doc(db, 'accounts', code), newAccount);
        resetMgmtForm();
    });

    mgmtAccountList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('edit-acc-btn')) {
            const index = parseInt(target.dataset.index!);
            const acc = accountData[index];
            mgmtAccountIndex.value = index.toString();
            mgmtAccountCode.value = acc.code;
            mgmtAccountName.value = acc.name;
            mgmtAccountImportantType.value = acc.importantType || 'none';
            mgmtBudgetผบง.value = (acc.budgets["ผบง."] || 0).toString();
            mgmtBudgetกบห.value = (acc.budgets["กบห."] || 0).toString();
            mgmtBudgetผปร.value = (acc.budgets["ผปร."] || 0).toString();
            mgmtBudgetผบค.value = (acc.budgets["ผบค."] || 0).toString();
            mgmtAccountSubmit.textContent = "อัปเดตรหัสบัญชี";
            mgmtAccountCancel.classList.remove('hidden');
            accountMgmtForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (target.classList.contains('delete-acc-btn')) {
            const index = parseInt(target.dataset.index!);
            const acc = accountData[index];
            showDeleteConfirm('คุณแน่ใจหรือไม่ว่าต้องการลบรหัสบัญชีนี้?', async () => {
                await deleteDoc(doc(db, 'accounts', acc.code));
            });
        }
    });

    mgmtAccountCancel.addEventListener('click', resetMgmtForm);

    // Password Toggle Logic
    const togglePasswordBtn = document.getElementById('toggle-password-btn')!;
    const eyeIcon = document.getElementById('eye-icon')!;
    const eyeOffIcon = document.getElementById('eye-off-icon')!;

    togglePasswordBtn.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.add('hidden');
            eyeOffIcon.classList.remove('hidden');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('hidden');
            eyeOffIcon.classList.add('hidden');
        }
    });

    // Check Login State
    initFirebaseSync();
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        showApp();
    } else {
        showLogin();
    }
});
