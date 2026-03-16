import { 
  auth, db, signInWithPopup, onAuthStateChanged, signOut,
  signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy,
  getDocFromServer
} from './firebase';
import { Account, Disbursement, User } from './types';

// DOM Elements
const loginScreen = document.getElementById('login-screen') as HTMLElement;
const appContainer = document.getElementById('app-container') as HTMLElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLElement;
const guestLoginBtn = document.getElementById('guest-login-btn') as HTMLElement;

const form = document.getElementById('disbursement-form') as HTMLFormElement;
const formTitle = document.getElementById('form-title') as HTMLElement;
const tableBody = document.getElementById('disbursement-table-body') as HTMLElement;
const statusFilter = document.getElementById('status-filter') as HTMLSelectElement;
const summaryContent = document.getElementById('summary-content') as HTMLElement;
const disbursementIdInput = document.getElementById('disbursement-id') as HTMLInputElement;
const priceInput = document.getElementById('price') as HTMLInputElement;
const taxInput = document.getElementById('tax') as HTMLInputElement;
const totalPriceInput = document.getElementById('total-price') as HTMLInputElement;
const whtInput = document.getElementById('wht') as HTMLInputElement;
const netTotalInput = document.getElementById('net-total') as HTMLInputElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const exportBtnHeader = document.getElementById('export-btn-header') as HTMLElement;
const summaryTypeFilter = document.getElementById('summary-type-filter') as HTMLSelectElement;
const dailyFilterContainer = document.getElementById('daily-filter-container') as HTMLElement;
const summaryDate = document.getElementById('summary-date') as HTMLInputElement;
const monthlyFilterContainer = document.getElementById('monthly-filter-container') as HTMLElement;
const summaryMonth = document.getElementById('summary-month') as HTMLInputElement;
const yearlyFilterContainer = document.getElementById('yearly-filter-container') as HTMLElement;
const summaryYear = document.getElementById('summary-year') as HTMLInputElement;
const summaryDeptFilter = document.getElementById('summary-dept-filter') as HTMLSelectElement;
const payeeFilterContainer = document.getElementById('payee-filter-container') as HTMLElement;
const summaryPayee = document.getElementById('summary-payee') as HTMLSelectElement;
const attachmentContainer = document.getElementById('attachment-container') as HTMLElement;
const attachmentInput = document.getElementById('attachment') as HTMLInputElement;
const attachmentNameDisplay = document.getElementById('attachment-name') as HTMLElement;

const accountCodeInput = document.getElementById('account-code') as HTMLInputElement;
const accountNameInput = document.getElementById('account-name') as HTMLInputElement;
const costCenterInput = document.getElementById('cost-center') as HTMLSelectElement;
const accountCodesDatalist = document.getElementById('account-codes') as HTMLElement;
const budgetInfo = document.getElementById('budget-info') as HTMLElement;
const budgetAllocatedDisplay = document.getElementById('budget-allocated') as HTMLElement;
const budgetRemainingDisplay = document.getElementById('budget-remaining') as HTMLElement;
const budgetProgress = document.getElementById('budget-progress') as HTMLElement;
const budgetUsageText = document.getElementById('budget-usage-text') as HTMLElement;

// State
let accountData: Account[] = [];
let disbursements: Disbursement[] = [];
let currentUser: User | null = null;
let accountsUnsubscribe: (() => void) | null = null;
let disbursementsUnsubscribe: (() => void) | null = null;

// Error Handling
enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId: string | undefined;
        email: string | null | undefined;
        emailVerified: boolean | undefined;
        isAnonymous: boolean | undefined;
        tenantId: string | null | undefined;
        providerInfo: {
            providerId: string;
            displayName: string | null;
            email: string | null;
            photoUrl: string | null;
        }[];
    }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    // Show user friendly message
    if (errInfo.error.includes('insufficient permissions')) {
        alert('คุณไม่มีสิทธิ์ในการดำเนินการนี้ กรุณาตรวจสอบการเข้าสู่ระบบของคุณ');
    } else if (errInfo.error.includes('quota exceeded')) {
        alert('โควตาการใช้งานฐานข้อมูลเต็มแล้ว กรุณาลองใหม่ในวันพรุ่งนี้');
    } else {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ' + errInfo.error);
    }
    
    throw new Error(JSON.stringify(errInfo));
};

// Connection Test
async function testConnection() {
    try {
        await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
            alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า Firebase");
        }
    }
}
testConnection();

// Firebase Sync
const syncData = () => {
    console.log('Starting data sync...');
    
    // Unsubscribe from previous listeners if they exist
    if (accountsUnsubscribe) {
        console.log('Unsubscribing from previous accounts listener');
        accountsUnsubscribe();
    }
    if (disbursementsUnsubscribe) {
        console.log('Unsubscribing from previous disbursements listener');
        disbursementsUnsubscribe();
    }

    // Sync Accounts
    accountsUnsubscribe = onSnapshot(collection(db, 'accounts'), (snapshot) => {
        console.log('Accounts snapshot received, count:', snapshot.size);
        accountData = snapshot.docs.map(doc => {
            const data = doc.data();
            // Ensure code is present even if not in document body (though it should be)
            return { ...data, code: data.code || doc.id } as Account;
        });
        console.log('Mapped accountData:', accountData);
        populateAccountDatalist();
        renderMgmtAccountList();
    }, (error) => {
        console.error('Accounts sync error:', error);
        handleFirestoreError(error, OperationType.GET, 'accounts');
    });

    // Sync Disbursements
    disbursementsUnsubscribe = onSnapshot(query(collection(db, 'disbursements'), orderBy('date', 'desc')), (snapshot) => {
        console.log('Disbursements snapshot received, count:', snapshot.size);
        disbursements = snapshot.docs.map(doc => doc.data() as Disbursement);
        renderTable();
        populatePayeeFilter();
        updateSummary();
    }, (error) => {
        console.error('Disbursements sync error:', error);
        handleFirestoreError(error, OperationType.GET, 'disbursements');
    });
};

// Auth
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? `User logged in: ${user.uid} (${user.email})` : 'User logged out');
    
    if (user) {
        // Try to determine username
        let username = sessionStorage.getItem('currentUser');
        if (!username || username === user.uid) {
            // If no username or it's just the UID, try to derive from email
            if (user.email && user.email.includes('@')) {
                username = user.email.split('@')[0];
            } else {
                // Check Firestore for a user document that has this UID
                try {
                    const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
                    if (!usersSnap.empty) {
                        username = usersSnap.docs[0].id;
                    }
                } catch (e) {
                    console.error('Error finding username by UID:', e);
                }
            }
        }

        if (!username) username = 'User';

        currentUser = { username, role: 'admin' };
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('currentUser', username);
        sessionStorage.setItem('firebaseUid', user.uid);
        sessionStorage.setItem('userEmail', user.email || '');
        
        console.log('Session state updated:', { username, uid: user.uid });
        
        showApp();
        syncData();
    } else {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        const role = sessionStorage.getItem('userRole');
        if (isLoggedIn && role === 'guest') {
            showApp();
            syncData();
        } else {
            showLogin();
        }
    }
});

// UI Functions
const showApp = () => {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    applyPermissions();
};

const showLogin = () => {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
};

const applyPermissions = () => {
    const role = sessionStorage.getItem('userRole');
    const username = sessionStorage.getItem('currentUser');
    const firebaseUid = sessionStorage.getItem('firebaseUid');
    const adminElements = document.querySelectorAll('.admin-only');
    const superAdminElements = document.querySelectorAll('.super-admin-only');
    const mainGrid = document.getElementById('main-grid') as HTMLElement;
    const tableColumn = document.getElementById('table-column') as HTMLElement;

    console.log('Applying permissions for:', { role, username, firebaseUid });

    if (role === 'guest') {
        adminElements.forEach(el => el.classList.add('hidden'));
        superAdminElements.forEach(el => el.classList.add('hidden'));
        mainGrid.classList.remove('lg:grid-cols-3');
        mainGrid.classList.add('lg:grid-cols-1');
        tableColumn.classList.remove('lg:col-span-2');
    } else {
        adminElements.forEach(el => el.classList.remove('hidden'));
        if (username === '9012844') { 
            console.log('Super Admin detected (9012844)');
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

        budgetAllocatedDisplay.textContent = allocated.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        budgetRemainingDisplay.textContent = remaining.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        budgetProgress.style.width = `${Math.min(usagePercent, 100)}%`;
        budgetProgress.className = usagePercent > 90 ? 'bg-red-600 h-1.5 rounded-full' : (usagePercent > 70 ? 'bg-yellow-600 h-1.5 rounded-full' : 'bg-indigo-600 h-1.5 rounded-full');
        budgetUsageText.textContent = `ใช้ไป ${usagePercent.toFixed(1)}%`;
        
        const userId = sessionStorage.getItem('currentUser');
        if (userId === '9012844' && budgetInfo) {
            budgetInfo.classList.remove('hidden');
        }
    } else {
        budgetInfo.classList.add('hidden');
    }
};

const renderTable = () => {
    tableBody.innerHTML = '';
    const filterValue = statusFilter.value;
    const filteredData = disbursements.filter(d => filterValue === 'all' || d.status === filterValue);

    if (filteredData.length === 0) {
        const colspan = sessionStorage.getItem('userRole') === 'admin' ? 8 : 7;
        tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-10 text-gray-500">ไม่พบรายการ</td></tr>`;
        return;
    }

    filteredData.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${d.date}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 font-medium">${d.accountCode || '-'}</div>
                <div class="text-xs text-gray-500">${d.costCenter || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 font-medium">${d.description}</div>
                <div class="text-xs text-gray-500">${d.accountName || ''}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${d.payee}</div>
                <div class="text-xs text-gray-500">${d.paymentMethod}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${parseFloat(d.netTotal).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    d.status === 'เสร็จสิ้น' ? 'bg-green-100 text-green-800' :
                    d.status === 'กำลังดำเนินการ' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                }">${d.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${d.attachment ? `<a href="${d.attachment}" target="_blank" class="text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4"/><path d="M10 16h4"/><path d="M12 10v6"/></svg> <span>ดูไฟล์</span></a>` : 'ไม่มี'}
            </td>
            ${sessionStorage.getItem('userRole') === 'admin' ? `
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="edit-btn text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1" data-id="${d.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg><span>แก้ไข</span>
                </button>
                <button class="delete-btn text-red-600 hover:text-red-900 ml-4 inline-flex items-center space-x-1" data-id="${d.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg><span>ลบ</span>
                </button>
            </td>` : ''}
        `;
        tableBody.appendChild(row);
    });
};

const updateSummary = () => {
    const mainFilterValue = statusFilter.value;
    const deptFilterValue = summaryDeptFilter.value;

    let filteredForTable = disbursements.filter(d => {
        const statusMatch = mainFilterValue === 'all' || d.status === mainFilterValue;
        const deptMatch = deptFilterValue === 'all' || d.costCenter === deptFilterValue;
        return statusMatch && deptMatch;
    });

    const summaryType = summaryTypeFilter.value;
    let summaryData = [];
    let selectedPeriod = '';

    switch (summaryType) {
        case 'daily': if (summaryDate.value) summaryData = filteredForTable.filter(d => d.date === summaryDate.value); break;
        case 'monthly': if (summaryMonth.value) { selectedPeriod = summaryMonth.value; summaryData = filteredForTable.filter(d => d.date.startsWith(selectedPeriod)); } break;
        case 'yearly': if (summaryYear.value) { selectedPeriod = summaryYear.value; summaryData = filteredForTable.filter(d => d.date.startsWith(selectedPeriod)); } break;
        case 'payee': if (summaryPayee.value) summaryData = filteredForTable.filter(d => d.payee === summaryPayee.value); break;
        default: summaryData = [...filteredForTable]; break;
    }

    const total = summaryData.reduce((sum, d) => sum + parseFloat(d.price), 0);
    summaryContent.innerHTML = `
        <p>จำนวน (ตามตัวกรองสรุป): ${summaryData.length} รายการ</p>
        <p class="font-semibold">ยอดรวม (ตามตัวกรองสรุป): ${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</p>
    `;

    const summaryDetailsList = document.getElementById('summary-details-list') as HTMLElement;
    summaryDetailsList.innerHTML = '';

    if (summaryData.length > 0 && summaryType !== 'all') {
        const list = document.createElement('ul');
        list.className = 'divide-y divide-gray-200';
        summaryData.forEach(d => {
            const listItem = document.createElement('li');
            listItem.className = 'py-2 flex justify-between items-center';
            listItem.innerHTML = `
                <div>
                    <p class="text-sm font-medium text-gray-900">${d.description} (${d.date})</p>
                    <p class="text-sm text-gray-500">${d.payee} [${d.costCenter}]</p>
                </div>
                <p class="text-sm font-medium text-gray-900">${parseFloat(d.price).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            `;
            list.appendChild(listItem);
        });
        summaryDetailsList.appendChild(list);
    }

    // Budget Summary Table
    const budgetSummaryContainer = document.getElementById('budget-summary-container') as HTMLElement;
    const budgetSummaryBody = document.getElementById('budget-summary-body') as HTMLElement;
    const budgetSummaryTitle = document.getElementById('budget-summary-title') as HTMLElement;
    const budgetColAnnual = document.getElementById('budget-col-annual') as HTMLElement;
    const budgetColPeriod = document.getElementById('budget-col-period') as HTMLElement;
    const budgetColSpent = document.getElementById('budget-col-spent') as HTMLElement;
    
    if ((summaryType === 'monthly' || summaryType === 'yearly') && selectedPeriod) {
        const username = sessionStorage.getItem('currentUser');
        if (username === '9012844') { 
            budgetSummaryContainer.classList.remove('hidden');
        } else {
            budgetSummaryContainer.classList.add('hidden');
        }
        budgetSummaryBody.innerHTML = '';

        const isYearly = summaryType === 'yearly';
        budgetSummaryTitle.textContent = isYearly ? `สรุปงบประมาณรายบัญชี (ประจำปี ${selectedPeriod})` : `สรุปงบประมาณรายบัญชี (ประจำเดือน ${selectedPeriod})`;
        budgetColAnnual.textContent = 'งบประมาณรวม/ปี';
        budgetColPeriod.innerHTML = isYearly ? 'งบประมาณ/ปี' : 'งบประมาณ/เดือน<br><span class="text-[9px]">(คิดเป็น 75% ของงบประมาณที่ได้รับ)</span>';
        budgetColSpent.textContent = isYearly ? 'เบิกจ่าย (ทั้งปี)' : 'เบิกจ่าย (เดือนนี้)';

        const allRelevantCodes = [...new Set(summaryData.map(d => d.accountCode))].filter(c => c);

        allRelevantCodes.forEach(code => {
            const account = accountData.find(a => a.code === code);
            if (!account) return;

            let annualBudgetForDept = deptFilterValue === 'all' ? Object.values(account.budgets).reduce((sum, b) => sum + b, 0) : (account.budgets[deptFilterValue] || 0);
            const monthlyBudget75 = (annualBudgetForDept / 12) * 0.75;
            const periodBudgetDisplay = isYearly ? annualBudgetForDept : monthlyBudget75;
            const periodSpent = summaryData.filter(d => d.accountCode === code).reduce((sum, d) => sum + parseFloat(d.price), 0);

            let totalSpentYear = 0;
            const currentYear = selectedPeriod.substring(0, 4);
            if (isYearly) {
                totalSpentYear = periodSpent;
            } else {
                totalSpentYear = disbursements
                    .filter(d => d.accountCode === code && d.date.startsWith(currentYear) && (deptFilterValue === 'all' || d.costCenter === deptFilterValue))
                    .reduce((sum, d) => sum + parseFloat(d.price), 0);
            }

            const remainingMonth = monthlyBudget75 - (isYearly ? (periodSpent / 12) : periodSpent);
            const remainingYear = annualBudgetForDept - totalSpentYear;
            const isOverThreshold = periodSpent > periodBudgetDisplay;

            const row = document.createElement('tr');
            row.className = isOverThreshold ? 'bg-red-50' : '';
            row.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap">
                    <div class="font-medium text-gray-900">${code}</div>
                    <div class="text-[10px] text-gray-500 truncate max-w-[120px]">${account.name}</div>
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">${annualBudgetForDept.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap">${periodBudgetDisplay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap font-medium ${isOverThreshold ? 'text-red-600' : ''}">${periodSpent.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap font-medium ${remainingMonth < 0 ? 'text-red-600' : 'text-gray-700'}">${remainingMonth.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

const populatePayeeFilter = () => {
    const payees = [...new Set(disbursements.map(d => d.payee))];
    summaryPayee.innerHTML = '<option value="">-- เลือกผู้รับเงิน --</option>';
    payees.sort().forEach(payee => {
        const option = document.createElement('option');
        option.value = payee;
        option.textContent = payee;
        summaryPayee.appendChild(option);
    });
};

// Event Listeners
/* Removed Google Login Listener */

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        return;
    }

    try {
        // Try Firebase Auth first (for 9012844 or other registered admins)
        const email = username.includes('@') ? username : `${username}@admin.com`;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('Firebase Auth login successful');
        } catch (authError: any) {
            console.log('Firebase Auth failed, checking Firestore mock login...', authError.code);
            
            // If it's the main admin and user not found, try to create it (bootstrap)
            if (username === '9012844' && password === 'PEATSG043' && (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential')) {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    console.log('Main admin bootstrapped in Firebase Auth');
                } catch (createError) {
                    console.error('Failed to bootstrap main admin in Auth:', createError);
                }
            }
            
            // Check Firestore for other users or if bootstrap failed
            try {
                const userDoc = await getDoc(doc(db, 'users', username));
                if (userDoc.exists() && userDoc.data().password === password) {
                    // Mock login successful, but we still need Firebase Auth for Firestore rules
                    if (!auth.currentUser) {
                        await signInAnonymously(auth);
                    }
                    
                    // Sync UID for admin 9012844 to enable Firestore rules
                    if (username === '9012844' && auth.currentUser) {
                        console.log('Syncing UID for bootstrap user 9012844...');
                        await setDoc(doc(db, 'users', '9012844'), { 
                            uid: auth.currentUser.uid,
                            password: password, // Include password to satisfy rules if isAdmin() fails
                            role: 'admin'
                        }, { merge: true }).catch(e => console.error('Sync UID failed:', e));
                    }

                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('currentUser', username);
                    sessionStorage.setItem('userRole', 'admin');
                    showApp();
                    syncData();
                    loginError.classList.add('hidden');
                    return;
                }
            } catch (firestoreError) {
                console.error('Firestore check failed:', firestoreError);
            }

            // Hardcoded fallback for main admin
            if (username === '9012844' && password === 'PEATSG043') {
                console.log('Using hardcoded fallback for 9012844');
                if (!auth.currentUser) {
                    try {
                        await signInAnonymously(auth);
                    } catch (anonError) {
                        console.error('Anonymous sign in failed:', anonError);
                    }
                }
                
                // Sync UID for admin 9012844 to enable Firestore rules
                if (auth.currentUser) {
                    try {
                        console.log('Syncing UID in fallback path...');
                        await setDoc(doc(db, 'users', '9012844'), { 
                            password: password, 
                            role: 'admin', 
                            uid: auth.currentUser.uid 
                        }, { merge: true });
                    } catch (syncError) {
                        console.error('Bootstrap sync failed:', syncError);
                        // Even if sync fails, we allow login because it's the hardcoded admin
                    }
                }

                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('currentUser', username);
                sessionStorage.setItem('userRole', 'admin');
                showApp();
                syncData();
                loginError.classList.add('hidden');
                return;
            } else {
                loginError.classList.remove('hidden');
                return;
            }
        }
        
        // If we reached here, Firebase Auth was successful
        // Sync UID for admin 9012844 to enable Firestore rules
        if (username === '9012844' && auth.currentUser) {
            console.log('Syncing UID after successful Firebase Auth...');
            await setDoc(doc(db, 'users', '9012844'), { password: password, role: 'admin', uid: auth.currentUser.uid }, { merge: true }).catch(e => console.error('Post-auth sync failed:', e));
        }

        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('currentUser', username);
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('userEmail', auth.currentUser?.email || '');
        showApp();
        syncData();
        loginError.classList.add('hidden');

    } catch (error) {
        console.error('Login error:', error);
        loginError.classList.remove('hidden');
    }
});

guestLoginBtn.addEventListener('click', () => {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userRole', 'guest');
    sessionStorage.removeItem('currentUser');
    showApp();
    syncData();
});

const headerLogoutBtn = document.getElementById('header-logout-btn') as HTMLElement;
headerLogoutBtn.addEventListener('click', async () => {
    await signOut(auth);
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
    const account = accountData.find(acc => acc.code === accountCodeInput.value);
    accountNameInput.value = account ? account.name : '';
    updateBudgetInfo();
});

costCenterInput.addEventListener('change', updateBudgetInfo);

const resetForm = () => {
    form.reset();
    disbursementIdInput.value = '';
    totalPriceInput.value = '';
    netTotalInput.value = '';
    attachmentInput.value = '';
    attachmentNameDisplay.textContent = '';
    attachmentContainer.classList.add('hidden');
    budgetInfo.classList.add('hidden');
    (document.querySelector('input[name="status"][value="กำลังดำเนินการ"]') as HTMLInputElement).checked = true;
    formTitle.textContent = 'บันทึกข้อมูล';
    submitBtn.textContent = 'บันทึก';
    cancelBtn.style.display = 'none';
};

const handleStatusChange = () => {
    const selectedStatus = (document.querySelector('input[name="status"]:checked') as HTMLInputElement).value;
    if (selectedStatus === 'เสร็จสิ้น') {
        attachmentContainer.classList.remove('hidden');
    } else {
        attachmentContainer.classList.add('hidden');
        attachmentInput.value = '';
        attachmentNameDisplay.textContent = '';
    }
};

document.querySelectorAll('input[name="status"]').forEach(radio => radio.addEventListener('change', handleStatusChange));

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = disbursementIdInput.value || Date.now().toString();
    const selectedStatus = (document.querySelector('input[name="status"]:checked') as HTMLInputElement).value;
    const existing = disbursements.find(d => d.id === id);

    let finalAttachmentData = null;
    let finalAttachmentName = null;
    const file = attachmentInput.files?.[0];

    if (selectedStatus === 'เสร็จสิ้น') {
        if (file) {
            if (file.type !== 'application/pdf') { alert('กรุณาเลือกไฟล์ PDF เท่านั้น'); return; }
            if (file.size > 5 * 1024 * 1024) { alert('ขนาดไฟล์ต้องไม่เกิน 5 MB'); return; }
            finalAttachmentData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result);
                reader.readAsDataURL(file);
            });
            finalAttachmentName = file.name;
        } else if (existing) {
            finalAttachmentData = existing.attachment;
            finalAttachmentName = existing.attachmentName;
        }
    }

    const data: Disbursement = {
        id,
        accountCode: accountCodeInput.value,
        accountName: accountNameInput.value,
        costCenter: costCenterInput.value,
        date: (document.getElementById('date') as HTMLInputElement).value,
        description: (document.getElementById('description') as HTMLInputElement).value,
        price: priceInput.value,
        tax: taxInput.value,
        totalPrice: totalPriceInput.value,
        wht: whtInput.value,
        netTotal: netTotalInput.value,
        payee: (document.getElementById('payee') as HTMLInputElement).value,
        paymentMethod: (document.getElementById('payment-method') as HTMLSelectElement).value,
        status: selectedStatus,
        attachment: finalAttachmentData as string | null,
        attachmentName: finalAttachmentName
    };

    try {
        await setDoc(doc(db, 'disbursements', id), data);
        resetForm();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `disbursements/${id}`);
    }
});

tableBody.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest('.edit-btn') as HTMLElement;
    if (editBtn) {
        const id = editBtn.dataset.id;
        const d = disbursements.find(item => item.id === id);
        if (!d) return;

        disbursementIdInput.value = d.id;
        accountCodeInput.value = d.accountCode || '';
        accountNameInput.value = d.accountName || '';
        costCenterInput.value = d.costCenter || '';
        (document.getElementById('date') as HTMLInputElement).value = d.date;
        (document.getElementById('description') as HTMLInputElement).value = d.description;
        priceInput.value = d.price;
        taxInput.value = d.tax;
        whtInput.value = d.wht;
        calculateAmounts();
        (document.getElementById('payee') as HTMLInputElement).value = d.payee;
        (document.getElementById('payment-method') as HTMLSelectElement).value = d.paymentMethod;
        (document.querySelector(`input[name="status"][value="${d.status}"]`) as HTMLInputElement).checked = true;
        handleStatusChange();
        attachmentNameDisplay.textContent = d.attachmentName ? `ไฟล์ปัจจุบัน: ${d.attachmentName}` : '';
        formTitle.textContent = 'แก้ไขรายการ';
        submitBtn.textContent = 'อัปเดต';
        cancelBtn.style.display = 'inline-flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const deleteBtn = target.closest('.delete-btn') as HTMLElement;
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
            try {
                await deleteDoc(doc(db, 'disbursements', id!));
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `disbursements/${id}`);
            }
        }
    }
});

cancelBtn.addEventListener('click', resetForm);
statusFilter.addEventListener('change', renderTable);
summaryTypeFilter.addEventListener('change', () => {
    dailyFilterContainer.classList.add('hidden');
    monthlyFilterContainer.classList.add('hidden');
    yearlyFilterContainer.classList.add('hidden');
    payeeFilterContainer.classList.add('hidden');
    switch (summaryTypeFilter.value) {
        case 'daily': dailyFilterContainer.classList.remove('hidden'); break;
        case 'monthly': monthlyFilterContainer.classList.remove('hidden'); break;
        case 'yearly': yearlyFilterContainer.classList.remove('hidden'); break;
        case 'payee': payeeFilterContainer.classList.remove('hidden'); break;
    }
    updateSummary();
});
[summaryDate, summaryMonth, summaryYear, summaryPayee, summaryDeptFilter].forEach(el => el.addEventListener('change', updateSummary));

// Settings Modal
const settingsBtn = document.getElementById('settings-btn') as HTMLElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const closeSettingsBtn = document.getElementById('close-settings-btn') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLElement;
const changePasswordForm = document.getElementById('change-password-form') as HTMLFormElement;
const addUserForm = document.getElementById('add-user-form') as HTMLFormElement;

settingsBtn.addEventListener('click', () => {
    applyPermissions();
    const userId = sessionStorage.getItem('currentUser');
    if (userId === '9012844') {
        renderSuperAdminUserList();
        renderMgmtAccountList();
    }
    settingsModal.classList.remove('hidden');
});

const manageAccountsQuickBtn = document.getElementById('manage-accounts-quick-btn') as HTMLElement;
manageAccountsQuickBtn.addEventListener('click', () => {
    applyPermissions();
    const userId = sessionStorage.getItem('currentUser');
    if (userId === '9012844') {
        renderSuperAdminUserList();
        renderMgmtAccountList();
    }
    settingsModal.classList.remove('hidden');
    // Scroll to account management section
    setTimeout(() => {
        document.getElementById('account-mgmt-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
});

const renderSuperAdminUserList = async () => {
    const userListEl = document.getElementById('super-admin-user-list') as HTMLElement;
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs.map(doc => ({ username: doc.id, ...doc.data() }));
    userListEl.innerHTML = '';
    
    users.forEach((user: any) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2 font-medium">${user.username}</td>
            <td class="px-4 py-2"><input type="text" class="super-admin-password-input border rounded px-2 py-1 w-full" value="${user.password}" data-username="${user.username}"></td>
            <td class="px-4 py-2 text-center">
                <button class="super-admin-save-btn text-green-600 hover:text-green-900 font-medium" data-username="${user.username}">บันทึก</button>
                ${user.username !== '9012844' ? `<button class="super-admin-delete-btn text-red-600 hover:text-red-900 ml-2 font-medium" data-username="${user.username}">ลบ</button>` : ''}
            </td>
        `;
        userListEl.appendChild(row);
    });
};

document.getElementById('super-admin-user-list')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const username = target.dataset.username;
    if (!username) return;

    if (target.classList.contains('super-admin-save-btn')) {
        const passwordInput = document.querySelector(`.super-admin-password-input[data-username="${username}"]`) as HTMLInputElement;
        try {
            await updateDoc(doc(db, 'users', username), { password: passwordInput.value });
            alert('บันทึกรหัสผ่านใหม่สำเร็จ');
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${username}`);
        }
    } else if (target.classList.contains('super-admin-delete-btn')) {
        if (confirm(`ยืนยันการลบผู้ใช้ ${username}?`)) {
            try {
                await deleteDoc(doc(db, 'users', username));
                renderSuperAdminUserList();
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `users/${username}`);
            }
        }
    }
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    sessionStorage.clear();
    showLogin();
});

changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = sessionStorage.getItem('currentUser');
    const currentPassword = (document.getElementById('current-password') as HTMLInputElement).value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement).value;
    const feedbackEl = document.getElementById('password-change-feedback') as HTMLElement;

    if (!currentUser) return;
    const userDoc = await getDoc(doc(db, 'users', currentUser));
    if (!userDoc.exists() || userDoc.data().password !== currentPassword) {
        feedbackEl.textContent = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
        feedbackEl.className = 'text-red-500 text-sm text-center mt-2';
        return;
    }

    try {
        await updateDoc(doc(db, 'users', currentUser), { password: newPassword });
        feedbackEl.textContent = 'เปลี่ยนรหัสผ่านสำเร็จแล้ว';
        feedbackEl.className = 'text-green-600 text-sm text-center mt-2';
        changePasswordForm.reset();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser}`);
    }
});

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = (document.getElementById('new-username') as HTMLInputElement).value;
    const newUserPassword = (document.getElementById('new-user-password') as HTMLInputElement).value;
    const feedbackEl = document.getElementById('add-user-feedback') as HTMLElement;

    const userDoc = await getDoc(doc(db, 'users', newUsername));
    if (userDoc.exists()) {
        feedbackEl.textContent = 'ชื่อผู้ใช้นี้มีอยู่แล้ว';
        feedbackEl.className = 'text-red-500 text-sm text-center mt-2';
        return;
    }

    try {
        await setDoc(doc(db, 'users', newUsername), { password: newUserPassword, role: 'admin' });
        feedbackEl.textContent = 'เพิ่มผู้ใช้งานสำเร็จแล้ว';
        feedbackEl.className = 'text-green-600 text-sm text-center mt-2';
        addUserForm.reset();
        renderSuperAdminUserList();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${newUsername}`);
    }
});

// Account Management
const accountMgmtForm = document.getElementById('account-mgmt-form') as HTMLFormElement;
const mgmtAccountIndex = document.getElementById('mgmt-account-index') as HTMLInputElement;
const mgmtAccountCode = document.getElementById('mgmt-account-code') as HTMLInputElement;
const mgmtAccountName = document.getElementById('mgmt-account-name') as HTMLInputElement;
const mgmtBudgetผบง = document.getElementById('mgmt-budget-ผบง') as HTMLInputElement;
const mgmtBudgetกบห = document.getElementById('mgmt-budget-กบห') as HTMLInputElement;
const mgmtBudgetผปร = document.getElementById('mgmt-budget-ผปร') as HTMLInputElement;
const mgmtBudgetผบค = document.getElementById('mgmt-budget-ผบค') as HTMLInputElement;
const mgmtAccountSubmit = document.getElementById('mgmt-account-submit') as HTMLButtonElement;
const mgmtAccountCancel = document.getElementById('mgmt-account-cancel') as HTMLButtonElement;
const mgmtAccountList = document.getElementById('mgmt-account-list') as HTMLElement;

const renderMgmtAccountList = () => {
    console.log('Rendering Mgmt Account List, data length:', accountData.length);
    mgmtAccountList.innerHTML = '';
    
    if (accountData.length === 0) {
        mgmtAccountList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500 italic">ยังไม่มีข้อมูลรหัสบัญชี</td></tr>';
        return;
    }

    accountData.forEach((acc, index) => {
        const budgets = acc.budgets || {};
        const totalBudget = Object.values(budgets).reduce((sum, b) => sum + (typeof b === 'number' ? b : 0), 0);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2 font-medium">${acc.code || '-'}</td>
            <td class="px-4 py-2 truncate max-w-[150px]">${acc.name || '-'}</td>
            <td class="px-4 py-2 text-right">${totalBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
    mgmtAccountIndex.value = "-1";
    mgmtAccountSubmit.textContent = "บันทึกรหัสบัญชี";
    mgmtAccountCancel.classList.add('hidden');
};

accountMgmtForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!mgmtAccountCode.value.trim()) {
        alert('กรุณากรอกรหัสบัญชี');
        return;
    }
    if (!mgmtAccountName.value.trim()) {
        alert('กรุณากรอกชื่อบัญชี');
        return;
    }

    const newAccount: Account = {
        code: mgmtAccountCode.value,
        name: mgmtAccountName.value,
        budgets: {
            "ผบง.": parseFloat(mgmtBudgetผบง.value) || 0,
            "กบห.": parseFloat(mgmtBudgetกบห.value) || 0,
            "ผปร.": parseFloat(mgmtBudgetผปร.value) || 0,
            "ผบค.": parseFloat(mgmtBudgetผบค.value) || 0
        }
    };
    try {
        console.log('Attempting to save account:', newAccount);
        await setDoc(doc(db, 'accounts', newAccount.code), newAccount);
        alert('บันทึกรหัสบัญชีสำเร็จ');
        resetMgmtForm();
    } catch (error) {
        console.error('Save account error:', error);
        handleFirestoreError(error, OperationType.WRITE, `accounts/${newAccount.code}`);
    }
});

mgmtAccountList.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const index = parseInt(target.dataset.index || '-1');
    if (index === -1) return;
    const acc = accountData[index];

    if (target.classList.contains('edit-acc-btn')) {
        mgmtAccountIndex.value = index.toString();
        mgmtAccountCode.value = acc.code;
        mgmtAccountName.value = acc.name;
        mgmtBudgetผบง.value = (acc.budgets["ผบง."] || 0).toString();
        mgmtBudgetกบห.value = (acc.budgets["กบห."] || 0).toString();
        mgmtBudgetผปร.value = (acc.budgets["ผปร."] || 0).toString();
        mgmtBudgetผบค.value = (acc.budgets["ผบค."] || 0).toString();
        mgmtAccountSubmit.textContent = "อัปเดตรหัสบัญชี";
        mgmtAccountCancel.classList.remove('hidden');
        accountMgmtForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (target.classList.contains('delete-acc-btn')) {
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรหัสบัญชีนี้?')) {
            try {
                console.log('Attempting to delete account:', acc.code);
                await deleteDoc(doc(db, 'accounts', acc.code));
                alert('ลบรหัสบัญชีสำเร็จ');
            } catch (error) {
                console.error('Delete account error:', error);
                handleFirestoreError(error, OperationType.DELETE, `accounts/${acc.code}`);
            }
        }
    }
});

mgmtAccountCancel.addEventListener('click', resetMgmtForm);

// Password Toggle
const togglePasswordBtn = document.getElementById('toggle-password-btn') as HTMLElement;
const eyeIcon = document.getElementById('eye-icon') as HTMLElement;
const eyeOffIcon = document.getElementById('eye-off-icon') as HTMLElement;

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

// Export CSV
const exportToCsv = (filename: string, rows: Disbursement[]) => {
    const header = ["วันที่", "รหัสบัญชี", "ชื่อบัญชี", "ศูนย์ต้นทุน", "รายละเอียด", "ราคา", "ภาษี (%)", "ราคารวม VAT", "หัก ณ ที่จ่าย (%)", "ยอดสุทธิ", "ผู้รับเงิน", "รูปแบบการจ่าย", "สถานะ"];
    const csvContent = [header.join(','), ...rows.map(row => 
        [
            `"${row.date}"`,
            `"${row.accountCode || ''}"`,
            `"${row.accountName || ''}"`,
            `"${row.costCenter || ''}"`,
            `"${row.description}"`,
            row.price,
            row.tax,
            row.totalPrice,
            row.wht,
            row.netTotal,
            `"${row.payee}"`,
            `"${row.paymentMethod}"`,
            `"${row.status}"`
        ].join(',')
    )].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

exportBtnHeader.addEventListener('click', () => {
    const filterValue = statusFilter.value;
    const data = disbursements.filter(d => filterValue === 'all' || d.status === filterValue);
    exportToCsv('disbursements.csv', data);
});

// Reset All Admins logic
const resetAdminsBtn = document.getElementById('reset-admins-btn') as HTMLElement;
resetAdminsBtn?.addEventListener('click', async () => {
    if (confirm('คำเตือน: การดำเนินการนี้จะลบข้อมูลแอดมินทั้งหมด (ยกเว้น 9012844) และตั้งค่ารหัสผ่านใหม่เป็น PEATSG043 คุณแน่ใจหรือไม่?')) {
        try {
            const snapshot = await getDocs(collection(db, 'users'));
            const deletePromises = snapshot.docs
                .filter(doc => doc.id !== '9012844')
                .map(doc => deleteDoc(doc.ref));
            
            await Promise.all(deletePromises);
            
            // Re-setup 9012844
            await setDoc(doc(db, 'users', '9012844'), { 
                password: 'PEATSG043', 
                role: 'admin',
                uid: auth.currentUser?.uid || '' 
            }, { merge: true });
            
            alert('ล้างข้อมูลแอดมินและตั้งค่าใหม่สำเร็จแล้ว ระบบจะออกจากระบบเพื่อให้คุณเข้าสู่ระบบใหม่');
            await signOut(auth);
            sessionStorage.clear();
            showLogin();
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'users');
        }
    }
});
