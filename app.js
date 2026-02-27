// ===== CONFIGURATION =====
const N8N_WEBHOOK_URL = 'https://n8n.osint-copilot.com/webhook/reputation-check';

// Default entities for Niko Technologies ecosystem
const DEFAULT_ENTITIES = [
    { name: 'Yurii Lamdan', type: 'person' },
    { name: 'Niko Tech', type: 'company' },
    { name: 'Niko Technologies', type: 'company' },
    { name: 'Elegro.eu', type: 'product' },
];

// ===== STATE =====
let entities = [...DEFAULT_ENTITIES];

// ===== DOM =====
const entityList = document.getElementById('entityList');
const newEntityInput = document.getElementById('newEntityInput');
const checkBtn = document.getElementById('checkBtn');
const statusPanel = document.getElementById('statusPanel');
const statusSpinner = document.getElementById('statusSpinner');
const statusTitle = document.getElementById('statusTitle');
const statusText = document.getElementById('statusText');
const stepsPanel = document.getElementById('stepsPanel');

const steps = [
    { id: 'step1', delay: 0 },
    { id: 'step2', delay: 4000 },
    { id: 'step3', delay: 10000 },
    { id: 'step4', delay: 18000 },
    { id: 'step5', delay: 25000 },
];

// ===== ENTITY MANAGEMENT =====
function renderEntities() {
    entityList.innerHTML = entities.map((entity, index) => `
        <div class="entity-tag" data-type="${entity.type}">
            <span class="entity-tag__type">${getTypeIcon(entity.type)}</span>
            <span class="entity-tag__name">${entity.name}</span>
            <button class="entity-tag__remove" onclick="removeEntity(${index})" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function getTypeIcon(type) {
    switch (type) {
        case 'person': return '👤';
        case 'company': return '🏢';
        case 'product': return '🌐';
        default: return '📌';
    }
}

function removeEntity(index) {
    const tag = entityList.children[index];
    tag.classList.add('entity-tag--removing');
    setTimeout(() => {
        entities.splice(index, 1);
        renderEntities();
    }, 200);
}

function addEntity() {
    const name = newEntityInput.value.trim();
    if (!name) {
        newEntityInput.focus();
        return;
    }

    // Auto-detect type
    let type = 'company';
    if (name.includes('.') || name.includes('://')) type = 'product';
    if (name.split(' ').length <= 3 && !name.includes('.') && /^[A-ZА-Я]/.test(name)) {
        const words = name.split(' ');
        if (words.length >= 2 && words.every(w => /^[A-ZА-Я]/.test(w))) type = 'person';
    }

    entities.push({ name, type });
    renderEntities();
    newEntityInput.value = '';
    newEntityInput.focus();
}

// ===== MAIN CHECK =====
async function startCheck() {
    if (entities.length === 0) {
        newEntityInput.focus();
        newEntityInput.style.borderColor = '#f87171';
        setTimeout(() => newEntityInput.style.borderColor = '', 2000);
        return;
    }

    // Disable UI
    checkBtn.disabled = true;
    document.querySelectorAll('.entity-tag__remove').forEach(btn => btn.disabled = true);

    // Show status
    statusPanel.style.display = 'flex';
    statusPanel.className = 'status';
    stepsPanel.style.display = 'flex';

    const entityNames = entities.map(e => e.name).join(', ');
    statusTitle.textContent = `Analyzing ${entities.length} entities...`;
    statusText.textContent = `Scanning: ${entityNames}`;
    statusSpinner.innerHTML = '<div class="status__ring"></div>';

    // Reset steps
    document.querySelectorAll('.step').forEach(s => {
        s.classList.remove('step--active', 'step--done');
    });

    animateSteps();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entities: entities,
                timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();

        // Mark all steps done
        steps.forEach(s => {
            const el = document.getElementById(s.id);
            el.classList.remove('step--active');
            el.classList.add('step--done');
        });

        // Show success
        statusPanel.classList.add('status--success');
        statusSpinner.innerHTML = `
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
            </svg>`;
        statusTitle.textContent = '✅ Report is ready!';
        statusText.textContent = 'Report published. Telegram notification sent.';

        if (data.reportUrl) {
            const link = document.createElement('a');
            link.href = data.reportUrl;
            link.target = '_blank';
            link.textContent = 'Open Report →';
            link.style.cssText = 'display:inline-block;margin-top:8px;color:#22d3ee;font-weight:600;text-decoration:none;';
            statusText.appendChild(document.createElement('br'));
            statusText.appendChild(link);
        }
    } catch (err) {
        console.error('Webhook error:', err);

        statusPanel.classList.add('status--error');
        statusSpinner.innerHTML = `
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>`;
        statusTitle.textContent = 'Analysis in progress';
        statusText.textContent = 'The scan is running in the background. You\'ll receive a Telegram notification when complete.';
    }

    setTimeout(() => {
        checkBtn.disabled = false;
        document.querySelectorAll('.entity-tag__remove').forEach(btn => btn.disabled = false);
    }, 5000);
}

function animateSteps() {
    steps.forEach((step, index) => {
        setTimeout(() => {
            const el = document.getElementById(step.id);
            if (index > 0) {
                const prev = document.getElementById(steps[index - 1].id);
                prev.classList.remove('step--active');
                prev.classList.add('step--done');
            }
            el.classList.add('step--active');
        }, step.delay);
    });
}

// Enter key in add input
newEntityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEntity();
});

// Init
renderEntities();
