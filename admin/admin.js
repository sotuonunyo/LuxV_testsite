// ⚠️ CONFIGURATION - YOUR GITHUB DETAILS
const GITHUB_USERNAME = 'sotuonunyo';
const REPO_NAME = 'candle-shop';
const BRANCH = 'main';

// GitHub API base URL - NO SPACES!
const API_BASE = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}`;

// Check if admin is logged in
if(localStorage.getItem('adminLoggedIn') !== 'true') {
  window.location.href = 'index.html';
}

// Logout function
function logout() {
  localStorage.removeItem('adminLoggedIn');
  window.location.href = '../index.html';
}

// Load products on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await loadSettings();
  await loadMailingList();
});

// Load Products from GitHub Pages
async function loadProducts() {
  try {
    const response = await fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/products.json`);
    const products = await response.json();
    renderProductList(products);
  } catch(error) {
    const container = document.getElementById('product-list');
    if(container) {
      container.innerHTML = '<p>No products yet. Add your first product above!</p>';
    }
  }
}

// Render Product List in Admin
function renderProductList(products) {
  const container = document.getElementById('product-list');
  if(!container) return;
  
  if(!products || products.length === 0) {
    container.innerHTML = '<p>No products yet. Add your first product above!</p>';
    return;
  }
  
  container.innerHTML = products.map((prod, index) => `
    <div class="product-item">
      <img src="${prod.image || 'https://via.placeholder.com/80'}" alt="${prod.name}">
      <div class="product-item-info">
        <strong>${prod.name}</strong><br>
        $${prod.price} | ${prod.inSlideshow ? '✨ In Slideshow' : ''}
      </div>
      <div class="product-item-actions">
        <button class="edit-btn" onclick="editProduct(${index})">Edit</button>
        <button class="delete-btn" onclick="deleteProduct(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

// Save Product (Create or Update)
async function saveProduct(event) {
  event.preventDefault();
  
  const editIndex = document.getElementById('edit-index').value;
  const name = document.getElementById('prod-name').value;
  const price = parseFloat(document.getElementById('prod-price').value);
  const description = document.getElementById('prod-desc').value;
  const ingredients = document.getElementById('prod-ingredients').value;
  let image = document.getElementById('prod-image').value;
  const inSlideshow = document.getElementById('prod-slideshow').checked;
  
  // Handle image upload
  const imageFile = document.getElementById('prod-image-upload').files[0];
  if(imageFile) {
    image = await uploadImageToGitHub(imageFile);
    if(!image) return; // Upload failed
  }
  
  const newProduct = { name, price, description, ingredients, image, inSlideshow };
  
  try {
    // Load existing products
    const response = await fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/products.json`);
    let products = await response.json();
    
    if(!Array.isArray(products)) products = [];
    
    if(editIndex !== '') {
      products[editIndex] = newProduct;
    } else {
      products.push(newProduct);
    }
    
    // Save to GitHub via API
    await saveToGitHub('_data/products.json', JSON.stringify(products, null, 2), 'Update products');
    
    // Show success & reset form
    const successEl = document.getElementById('form-success');
    if(successEl) {
      successEl.style.display = 'block';
      setTimeout(() => successEl.style.display = 'none', 3000);
    }
    
    document.getElementById('product-form').reset();
    document.getElementById('edit-index').value = '';
    document.getElementById('form-title').textContent = '➕ Add New Product';
    document.getElementById('save-btn').textContent = '💾 Save Product';
    document.getElementById('image-preview').style.display = 'none';
    
    // Reload products
    await loadProducts();
    
  } catch(error) {
    console.error('Error saving product:', error);
    const errorEl = document.getElementById('form-error');
    if(errorEl) {
      errorEl.textContent = 'Error: ' + error.message;
      errorEl.style.display = 'block';
      setTimeout(() => errorEl.style.display = 'none', 5000);
    }
  }
}

// Edit Product (fill form)
function editProduct(index) {
  fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/products.json`)
    .then(res => res.json())
    .then(products => {
      const prod = products[index];
      document.getElementById('edit-index').value = index;
      document.getElementById('prod-name').value = prod.name;
      document.getElementById('prod-price').value = prod.price;
      document.getElementById('prod-desc').value = prod.description;
      document.getElementById('prod-ingredients').value = prod.ingredients || '';
      document.getElementById('prod-image').value = prod.image || '';
      document.getElementById('prod-slideshow').checked = prod.inSlideshow || false;
      
      if(prod.image) {
        document.getElementById('image-preview').src = prod.image;
        document.getElementById('image-preview').style.display = 'block';
      }
      
      document.getElementById('form-title').textContent = '✏️ Edit Product';
      document.getElementById('save-btn').textContent = '💾 Update Product';
      window.scrollTo(0, 0);
    })
    .catch(err => {
      console.error('Error loading product:', err);
      alert('Could not load product for editing');
    });
}

// Delete Product
async function deleteProduct(index) {
  if(!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    const response = await fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/products.json`);
    let products = await response.json();
    products.splice(index, 1);
    
    await saveToGitHub('_data/products.json', JSON.stringify(products, null, 2), 'Delete product');
    await loadProducts();
  } catch(error) {
    alert('Error deleting product: ' + error.message);
  }
}

// Cancel Edit
function cancelEdit() {
  document.getElementById('product-form').reset();
  document.getElementById('edit-index').value = '';
  document.getElementById('form-title').textContent = '➕ Add New Product';
  document.getElementById('save-btn').textContent = '💾 Save Product';
  document.getElementById('image-preview').style.display = 'none';
}

// Preview Image Upload
function previewImage(event) {
  const file = event.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('image-preview').src = e.target.result;
      document.getElementById('image-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

// ✅ FIXED: Upload Image to GitHub (Auto-creates images/ folder)
async function uploadImageToGitHub(file) {
  const token = localStorage.getItem('githubToken');
  if(!token) {
    alert('⚠️ GitHub token not set! Please paste your token at the top of the dashboard.');
    return '';
  }

  // Create safe filename
  const safeName = file.name.replace(/\s/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
  const fileName = `images/${Date.now()}-${safeName}`;
  
  // Convert file to base64
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });

  console.log('📤 Uploading:', fileName);

  try {
    const response = await fetch(`${API_BASE}/contents/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload: ${file.name}`,
        content: base64,
        branch: BRANCH
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Upload success');
      return `https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/${fileName}`;
    } else {
      console.error('❌ Upload failed:', data);
      let msg = data.message || 'Upload failed';
      
      if(msg.includes('401')) msg = 'Invalid token. Re-save your token.';
      else if(msg.includes('403')) msg = 'Token needs "repo" permission.';
      else if(msg.includes('404')) msg = 'Repo not found. Check username/repo in admin.js';
      
      alert('Image upload failed: ' + msg);
      return '';
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
    alert('Upload failed: ' + error.message);
    return '';
  }
}

// Load Settings
async function loadSettings() {
  try {
    const response = await fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/settings.json`);
    const settings = await response.json();
    
    const fields = ['whatsapp', 'bank', 'account-num', 'account-name', 'address', 'phone', 'email', 'hours', 'theme'];
    const keys = ['whatsapp', 'bankName', 'accountNumber', 'accountName', 'address', 'phone', 'email', 'hours', 'theme'];
    
    fields.forEach((field, i) => {
      const el = document.getElementById(`set-${field}`);
      if(el && settings[keys[i]]) {
        el.value = settings[keys[i]];
      }
    });
  } catch(error) {
    console.log('No settings yet');
  }
}

// Save Settings
async function saveSettings(event) {
  event.preventDefault();
  
  const settings = {
    whatsapp: document.getElementById('set-whatsapp').value,
    bankName: document.getElementById('set-bank').value,
    accountNumber: document.getElementById('set-account-num').value,
    accountName: document.getElementById('set-account-name').value,
    address: document.getElementById('set-address').value,
    phone: document.getElementById('set-phone').value,
    email: document.getElementById('set-email').value,
    hours: document.getElementById('set-hours').value,
    theme: document.getElementById('set-theme').value
  };
  
  try {
    await saveToGitHub('_data/settings.json', JSON.stringify(settings, null, 2), 'Update settings');
    const successEl = document.getElementById('settings-success');
    if(successEl) {
      successEl.style.display = 'block';
      setTimeout(() => successEl.style.display = 'none', 3000);
    }
  } catch(error) {
    alert('Error saving settings: ' + error.message);
  }
}

// Load Mailing List
async function loadMailingList() {
  try {
    const response = await fetch(`https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/_data/mailing-list.json`);
    const list = await response.json();
    
    const container = document.getElementById('mailing-list');
    if(!container) return;
    
    if(!list || list.length === 0) {
      container.innerHTML = '<p>No subscribers yet.</p>';
      return;
    }
    
    container.innerHTML = list.map(sub => `
      <div class="mailing-item">
        <span>${sub.name} - ${sub.email}</span>
        <small style="color: #999">${new Date(sub.date).toLocaleDateString()}</small>
      </div>
    `).join('');
  } catch(error) {
    const container = document.getElementById('mailing-list');
    if(container) container.innerHTML = '<p>No subscribers yet.</p>';
  }
}

// Save Data to GitHub via API
async function saveToGitHub(filePath, content, message) {
  const token = localStorage.getItem('githubToken');
  if(!token) {
    throw new Error('GitHub token not set');
  }
  
  // Get existing file SHA (if exists)
  let sha = '';
  try {
    const res = await fetch(`${API_BASE}/contents/${filePath}?ref=${BRANCH}`, {
      headers: { 'Authorization': `token ${token}` }
    });
    if(res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch(e) {
    // File doesn't exist - that's ok
  }
  
  const body = {
    message: message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH
  };
  if(sha) body.sha = sha;
  
  const response = await fetch(`${API_BASE}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Save failed');
  }
  
  return true;
}

// === TOKEN MANAGEMENT ===

function saveToken() {
  const token = document.getElementById('github-token-input').value.trim();
  if(!token) {
    alert('Please enter your GitHub token');
    return;
  }
  if(!token.startsWith('ghp_')) {
    alert('Token should start with "ghp_"');
    return;
  }
  
  localStorage.setItem('githubToken', token);
  document.getElementById('github-token-input').value = '';
  
  const statusEl = document.getElementById('token-status');
  if(statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = '✅ GitHub token saved!';
    statusEl.style.background = '#e8f5e9';
    statusEl.style.color = '#2e7d32';
    setTimeout(() => statusEl.style.display = 'none', 3000);
  }
  console.log('✅ Token saved');
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('githubToken');
  const statusEl = document.getElementById('token-status');
  if(!statusEl) return;
  
  if(token && token.startsWith('ghp_')) {
    statusEl.style.display = 'block';
    statusEl.textContent = '✅ GitHub token is set.';
    statusEl.style.background = '#e8f5e9';
    statusEl.style.color = '#2e7d32';
  } else {
    statusEl.style.display = 'block';
    statusEl.textContent = '⚠️ GitHub token not set. Paste token above.';
    statusEl.style.background = '#fff3e0';
    statusEl.style.color = '#ef6c00';
  }
});
