(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  let expression = '';
  let answer = 0;
  let angleMode = 'DEG';
  let justCalculated = false;
  let history = [];

  function render() {
    expressionEl.textContent = expression || '\u00a0';
    if (expression) {
      try { resultEl.textContent = format(evaluate(expression)); }
      catch { resultEl.textContent = '…'; }
    } else resultEl.textContent = '0';
  }
  function format(value) {
    if (!Number.isFinite(value)) throw new Error('Invalid result');
    const rounded = Number(value.toPrecision(12));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }
  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('Factorial is defined for whole numbers from 0 to 170');
    let out = 1;
    for (let i = 2; i <= n; i++) out *= i;
    return out;
  }
  function evaluate(source) {
    const input = source.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
    const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|(?:asin|acos|atan|sqrt|cbrt|log|ln|sin|cos|tan|pi|Ans|\d+)|[()+\-*/^%!]/gi);
    if (!tokens || tokens.join('') !== input.replace(/\s+/g, '')) throw new Error('Invalid expression');
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    const angle = n => angleMode === 'DEG' ? n * Math.PI / 180 : n;
    const fromAngle = n => angleMode === 'DEG' ? n * 180 / Math.PI : n;
    function primary() {
      const token = take();
      if (token === undefined) throw new Error('Incomplete expression');
      const lower = token.toLowerCase();
      if (token === '+') return unary();
      if (token === '-') return -unary();
      if (token === '(') {
        const value = sum();
        if (take() !== ')') throw new Error('Missing closing parenthesis');
        return value;
      }
      if (/^(?:\d|\.)/.test(token)) return Number(token);
      if (lower === 'pi') return Math.PI;
      if (lower === 'e') return Math.E;
      if (lower === 'ans') return answer;
      if (['sin','cos','tan','asin','acos','atan','sqrt','cbrt','log','ln'].includes(lower)) {
        if (peek() === '(') take();
        const value = sum();
        if (peek() === ')') take();
        if (lower === 'sin') return Math.sin(angle(value));
        if (lower === 'cos') return Math.cos(angle(value));
        if (lower === 'tan') return Math.tan(angle(value));
        if (lower === 'asin') return fromAngle(Math.asin(value));
        if (lower === 'acos') return fromAngle(Math.acos(value));
        if (lower === 'atan') return fromAngle(Math.atan(value));
        if (lower === 'sqrt') return Math.sqrt(value);
        if (lower === 'cbrt') return Math.cbrt(value);
        if (lower === 'log') return Math.log10(value);
        return Math.log(value);
      }
      throw new Error('Unexpected token');
    }
    function postfix() {
      let value = primary();
      while (peek() === '!' || peek() === '%') {
        const op = take();
        value = op === '!' ? factorial(value) : value / 100;
      }
      return value;
    }
    function power() {
      let value = postfix();
      if (peek() === '^') { take(); value = value ** unary(); }
      return value;
    }
    function unary() { return power(); }
    function product() {
      let value = unary();
      while (peek() === '*' || peek() === '/') {
        const op = take(), right = unary();
        value = op === '*' ? value * right : value / right;
      }
      return value;
    }
    function sum() {
      let value = product();
      while (peek() === '+' || peek() === '-') {
        const op = take(), right = product();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }
    const result = sum();
    if (pos !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid calculation');
    return result;
  }
  function append(value) {
    if (justCalculated && /^(?:\d|\.|π|e|Ans|\()/.test(value)) expression = '';
    justCalculated = false;
    if (value === '^2') expression += '^2';
    else if (value === '1/') expression = `1/(${expression || '0'}`;
    else expression += value;
    render();
  }
  function closeOpenParentheses() {
    const opens = (expression.match(/\(/g) || []).length;
    const closes = (expression.match(/\)/g) || []).length;
    return ')'.repeat(Math.max(0, opens - closes));
  }
  function calculate() {
    if (!expression) return;
    try {
      const completed = expression + closeOpenParentheses();
      const value = evaluate(completed);
      answer = value;
      history.unshift({ expression: completed, result: format(value) });
      history = history.slice(0, 10);
      renderHistory();
      expression = format(value);
      justCalculated = true;
      expressionEl.textContent = completed + ' =';
      resultEl.textContent = format(value);
    } catch (error) {
      resultEl.textContent = error.message.includes('Factorial') ? 'Domain error' : 'Math error';
    }
  }
  function renderHistory() {
    if (!history.length) {
      historyList.innerHTML = '<p class="empty-history">Your calculations will appear here.</p>';
      return;
    }
    historyList.replaceChildren(...history.map(item => {
      const button = document.createElement('button');
      button.className = 'history-item';
      button.type = 'button';
      const expr = document.createElement('span');
      const result = document.createElement('strong');
      expr.textContent = item.expression;
      result.textContent = item.result;
      button.append(expr, result);
      button.addEventListener('click', () => { expression = item.result; justCalculated = true; render(); });
      return button;
    }));
  }
  document.getElementById('keypad').addEventListener('click', event => {
    const key = event.target.closest('button');
    if (!key) return;
    if (key.dataset.value !== undefined) append(key.dataset.value);
    else if (key.dataset.action === 'clear') { expression = ''; justCalculated = false; render(); }
    else if (key.dataset.action === 'delete') { expression = expression.slice(0, -1); justCalculated = false; render(); }
    else if (key.dataset.action === 'equals') calculate();
    else if (key.dataset.action === 'sign') append('−');
  });
  document.getElementById('deg-mode').addEventListener('click', () => setMode('DEG'));
  document.getElementById('rad-mode').addEventListener('click', () => setMode('RAD'));
  function setMode(mode) {
    angleMode = mode;
    document.getElementById('deg-mode').classList.toggle('active', mode === 'DEG');
    document.getElementById('rad-mode').classList.toggle('active', mode === 'RAD');
    document.getElementById('deg-mode').setAttribute('aria-pressed', String(mode === 'DEG'));
    document.getElementById('rad-mode').setAttribute('aria-pressed', String(mode === 'RAD'));
    render();
  }
  document.getElementById('history-toggle').addEventListener('click', () => { historyPanel.hidden = !historyPanel.hidden; });
  document.getElementById('clear-history').addEventListener('click', () => { history = []; renderHistory(); });
  document.getElementById('copy-result').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultEl.textContent); } catch { /* clipboard may be unavailable on local files */ }
  });
  document.addEventListener('keydown', event => {
    if (/^\d$/.test(event.key) || ['.', '+', '-', '*', '/', '^', '(', ')', '%', '!'].includes(event.key)) {
      event.preventDefault();
      append(event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key === '-' ? '−' : event.key);
    } else if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    else if (event.key === 'Backspace') { event.preventDefault(); expression = expression.slice(0, -1); render(); }
    else if (event.key === 'Escape' || event.key === 'Delete') { expression = ''; justCalculated = false; render(); }
  });
  render();
})();
