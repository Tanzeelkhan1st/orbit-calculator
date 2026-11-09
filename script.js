(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const calculatorEl = document.querySelector('.calculator');
  const scienceToggle = document.getElementById('science-toggle');
  const standardToggle = document.getElementById('standard-toggle');
  const sciencePanel = document.getElementById('science-panel');
  const angleToggle = document.getElementById('angle-toggle');
  let expression = '';
  let answer = 0;
  let memory = 0;
  const samples = [];
  let angleMode = 'DEG';
  let justCalculated = false;
  let hypMode = false;

  const functions = new Set(['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'log', 'ln', 'ncr', 'pol']);

  function format(value) {
    if (!Number.isFinite(value)) throw new Error('Math error');
    const rounded = Number(value.toPrecision(12));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  function tokenize(source) {
    const input = source.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi');
    const tokens = [];
    let i = 0;
    while (i < input.length) {
      const rest = input.slice(i);
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
      if (number) { tokens.push({ type: 'number', value: Number(number[0]) }); i += number[0].length; continue; }
      const name = /^[a-zA-Z]+/.exec(rest);
      if (name) { tokens.push({ type: 'name', value: name[0].toLowerCase() }); i += name[0].length; continue; }
      const char = input[i];
      if ('+-*/^()%!,'.includes(char)) { tokens.push({ type: 'symbol', value: char }); i++; continue; }
      if (/\s/.test(char)) { i++; continue; }
      throw new Error('Invalid character');
    }
    const expanded = [];
    for (const token of tokens) {
      const previous = expanded[expanded.length - 1];
      const endsValue = previous && (previous.type === 'number' || previous.type === 'name' || previous.value === ')' || previous.value === '!' || previous.value === '%');
      const startsValue = token.type === 'number' || token.type === 'name' || token.value === '(';
      const functionCall = previous?.type === 'name' && functions.has(previous.value) && token.value === '(';
      if (endsValue && startsValue && !functionCall) expanded.push({ type: 'symbol', value: '*' });
      expanded.push(token);
    }
    return expanded;
  }

  function evaluate(source) {
    const tokens = tokenize(source);
    let cursor = 0;
    const peek = () => tokens[cursor]?.value;
    const take = () => tokens[cursor++];
    const toRadians = value => angleMode === 'DEG' ? value * Math.PI / 180 : value;

    function primary() {
      const token = take();
      if (!token) throw new Error('Incomplete expression');
      if (token.type === 'number') return token.value;
      if (token.value === '(') {
        const value = sum();
        if (take()?.value !== ')') throw new Error('Missing )');
        return value;
      }
      if (token.type !== 'name') throw new Error('Unexpected value');
      if (token.value === 'pi') return Math.PI;
      if (token.value === 'e') return Math.E;
      if (token.value === 'ans') return answer;
      if (!functions.has(token.value)) throw new Error('Unknown function');

      let args;
      if (peek() === '(') {
        take();
        args = [];
        if (peek() !== ')') {
          args.push(sum());
          while (peek() === ',') { take(); args.push(sum()); }
        }
        if (take()?.value !== ')') throw new Error('Missing )');
      } else args = [unary()];
      const value = args[0];
      switch (token.value) {
        case 'sin': return Math.sin(toRadians(value));
        case 'cos': return Math.cos(toRadians(value));
        case 'tan': return Math.tan(toRadians(value));
        case 'sinh': return Math.sinh(value);
        case 'cosh': return Math.cosh(value);
        case 'tanh': return Math.tanh(value);
        case 'sqrt': return Math.sqrt(value);
        case 'cbrt': return Math.cbrt(value);
        case 'log': return Math.log10(value);
        case 'ln': return Math.log(value);
        case 'pol': if (args.length === 2) return Math.hypot(args[0], args[1]); throw new Error('Pol needs x,y');
        case 'ncr': {
          const [n, r] = args;
          if (args.length !== 2 || !Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) throw new Error('Combination domain');
          let result = 1;
          for (let j = 1; j <= Math.min(r, n - r); j++) result = result * (n - j + 1) / j;
          return result;
        }
      }
      throw new Error('Unknown function');
    }
    function postfix() {
      let value = primary();
      while (peek() === '!' || peek() === '%') {
        if (take().value === '%') value /= 100;
        else {
          if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorial domain');
          let factorial = 1;
          for (let n = 2; n <= value; n++) factorial *= n;
          value = factorial;
        }
      }
      return value;
    }
    function power() { const left = postfix(); return peek() === '^' ? (take(), left ** unary()) : left; }
    function unary() {
      if (peek() === '+') { take(); return unary(); }
      if (peek() === '-') { take(); return -unary(); }
      return power();
    }
    function product() {
      let value = unary();
      while (peek() === '*' || peek() === '/') { const op = take().value, right = unary(); value = op === '*' ? value * right : value / right; }
      return value;
    }
    function sum() {
      let value = product();
      while (peek() === '+' || peek() === '-') { const op = take().value, right = product(); value = op === '+' ? value + right : value - right; }
      return value;
    }
    const result = sum();
    if (cursor !== tokens.length) throw new Error('Incomplete expression');
    return result;
  }

  function renderInput() {
    expressionEl.textContent = expression || '\u00a0';
    resultEl.textContent = '';
  }
  function insert(value) {
    if (hypMode && /^sin|^cos|^tan/.test(value)) {
      value = value.replace(/^(sin|cos|tan)/, '$1h');
      hypMode = false;
      document.querySelector('[data-action="hyp"]').setAttribute('aria-pressed', 'false');
    }
    if (justCalculated && (/^[\d.]$/.test(value) || ['π', 'e', 'Ans', '('].includes(value))) expression = '';
    const binaryOperators = ['+', '−', '×', '÷', '^'];
    const last = expression.slice(-1);
    if (binaryOperators.includes(value)) {
      if (!expression) {
        if (value !== '−') return;
      } else if (binaryOperators.includes(last)) {
        expression = expression.slice(0, -1) + value;
        justCalculated = false;
        renderInput();
        return;
      } else if (last === '(' && value !== '−') return;
    }
    if (value === '%' || value === '!') {
      if (!/[\d)]$/.test(expression) || last === '%' || last === '!') return;
    }
    if (value === '.') {
      const currentNumber = expression.match(/[\d.]*$/)?.[0] || '';
      if (currentNumber.includes('.')) return;
    }
    justCalculated = false;
    expression += value;
    renderInput();
  }
  function clear() {
    expression = '';
    justCalculated = false;
    expressionEl.textContent = '\u00a0';
    resultEl.textContent = '0';
  }
  function deleteLast() {
    if (justCalculated) justCalculated = false;
    expression = expression.slice(0, -1);
    renderInput();
  }
  function toggleSign() {
    if (!expression) expression = '−';
    else {
      const match = /[−-]?(?:\d+\.?\d*|\.\d+)$/.exec(expression);
      if (match) {
        const number = match[0];
        const sign = number.startsWith('−') || number.startsWith('-');
        expression = expression.slice(0, -number.length) + (sign ? number.slice(1) : `−${number}`);
      } else if (/[+−×÷^(]$/.test(expression)) expression += '−';
    }
    justCalculated = false;
    renderInput();
  }
  function completedExpression(source = expression) {
    const opens = (source.match(/\(/g) || []).length;
    const closes = (source.match(/\)/g) || []).length;
    return source + ')'.repeat(Math.max(0, opens - closes));
  }
  function currentValue() {
    if (justCalculated) return answer;
    if (!expression) return answer;
    return evaluate(completedExpression());
  }
  function calculate() {
    if (!expression) return;
    try {
      const completed = completedExpression();
      const value = evaluate(completed);
      const output = format(value);
      answer = value;
      expressionEl.textContent = `${completed} =`;
      resultEl.textContent = output;
      expression = output;
      justCalculated = true;
    } catch (error) {
      expressionEl.textContent = expression;
      resultEl.textContent = error.message === 'Factorial domain' || error.message === 'Combination domain' ? 'Domain error' : 'Math error';
      justCalculated = false;
    }
  }
  function reciprocal() {
    expression = expression ? `1/(${expression})` : '1/(';
    justCalculated = false;
    renderInput();
  }
  function displayDms() {
    try {
      const value = currentValue();
      const absolute = Math.abs(value);
      const degrees = Math.floor(absolute);
      const minutesFloat = (absolute - degrees) * 60;
      const minutes = Math.floor(minutesFloat);
      const seconds = (minutesFloat - minutes) * 60;
      const sign = value < 0 ? '−' : '';
      expressionEl.textContent = `${format(value)} DMS`;
      resultEl.textContent = `${sign}${degrees}° ${minutes}′ ${format(seconds)}″`;
      answer = value;
      expression = format(value);
      justCalculated = true;
    } catch { resultEl.textContent = 'Math error'; }
  }
  function displayEngineering() {
    try {
      const value = currentValue();
      if (!value) { resultEl.textContent = '0'; return; }
      const exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
      expressionEl.textContent = `${format(value)} ENG`;
      resultEl.textContent = `${format(value / 10 ** exponent)}e${exponent >= 0 ? '+' : ''}${exponent}`;
      answer = value;
      expression = format(value);
      justCalculated = true;
    } catch { resultEl.textContent = 'Math error'; }
  }

  document.querySelector('.calculator').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.insert !== undefined) insert(button.dataset.insert);
    else if (button.dataset.action === 'clear') clear();
    else if (button.dataset.action === 'delete') deleteLast();
    else if (button.dataset.action === 'equals') calculate();
    else if (button.dataset.action === 'sign') toggleSign();
    else if (button.dataset.action === 'reciprocal') reciprocal();
    else if (button.dataset.action === 'hyp') {
      hypMode = !hypMode;
      button.setAttribute('aria-pressed', String(hypMode));
    } else if (button.dataset.action === 'dms') displayDms();
    else if (button.dataset.action === 'engineering') displayEngineering();
    else if (button.dataset.action === 'recall') insert(format(memory));
    else if (button.dataset.action === 'memory-add' || button.dataset.action === 'memory-subtract') {
      try { memory += (button.dataset.action === 'memory-add' ? 1 : -1) * currentValue(); }
      catch { resultEl.textContent = 'Math error'; }
    } else if (button.dataset.action === 'stat-add') {
      try {
        samples.push(currentValue());
        expressionEl.textContent = `${samples.length} value${samples.length === 1 ? '' : 's'} stored`;
        resultEl.textContent = `Σ ${format(samples.reduce((sum, value) => sum + value, 0))}`;
      } catch { resultEl.textContent = 'Math error'; }
    } else if (button.dataset.action === 'stat-variance') {
      if (samples.length < 2) { resultEl.textContent = 'Need 2+ values'; return; }
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
      expressionEl.textContent = `Population variance · n=${samples.length}`;
      resultEl.textContent = format(variance);
    }
  });

  function setMode(scientific) {
    calculatorEl.classList.remove('is-transitioning');
    void calculatorEl.offsetWidth;
    calculatorEl.classList.toggle('mode-scientific', scientific);
    calculatorEl.classList.toggle('mode-standard', !scientific);
    calculatorEl.classList.add('is-transitioning');
    window.setTimeout(() => calculatorEl.classList.remove('is-transitioning'), 1200);
    sciencePanel.hidden = !scientific;
    angleToggle.hidden = !scientific;
    scienceToggle.setAttribute('aria-expanded', String(scientific));
    scienceToggle.setAttribute('aria-pressed', String(scientific));
    standardToggle.setAttribute('aria-pressed', String(!scientific));
    standardToggle.classList.toggle('is-active', !scientific);
    scienceToggle.classList.toggle('is-active', scientific);
  }
  scienceToggle.addEventListener('click', () => setMode(true));
  standardToggle.addEventListener('click', () => setMode(false));
  document.querySelectorAll('.keys').forEach(grid => {
    Array.from(grid.children).forEach((key, index) => key.style.setProperty('--key-delay', `${index * 18}ms`));
  });

  function fitResultText() {
    const text = resultEl.textContent.trim();
    if (!text) { resultEl.style.removeProperty('font-size'); return; }
    const width = resultEl.clientWidth - 8;
    if (!width) return;
    const style = window.getComputedStyle(resultEl);
    const canvas = fitResultText.canvas || (fitResultText.canvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    context.font = `500 56px ${style.fontFamily}`;
    const measured = context.measureText(text).width;
    const fittedSize = Math.max(20, Math.min(56, 56 * width / measured));
    resultEl.style.fontSize = `${fittedSize}px`;
  }
  new MutationObserver(fitResultText).observe(resultEl, { childList: true, characterData: true, subtree: true });
  window.addEventListener('resize', fitResultText);
  fitResultText();
  function setAngle(mode) {
    angleMode = mode;
    for (const [id, value] of [['deg', 'DEG'], ['rad', 'RAD']]) {
      const button = document.getElementById(id);
      button.classList.toggle('selected', value === mode);
      button.setAttribute('aria-pressed', String(value === mode));
    }
  }
  document.getElementById('deg').addEventListener('click', () => setAngle('DEG'));
  document.getElementById('rad').addEventListener('click', () => setAngle('RAD'));

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^\d$/.test(event.key) || /^[a-zA-Z]$/.test(event.key) || ['.', '+', '-', '*', '/', '^', '(', ')', '%', '!'].includes(event.key)) {
      event.preventDefault();
      const mapped = { '*': '×', '/': '÷', '-': '−' }[event.key] || event.key;
      insert(mapped);
    } else if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    else if (event.key === 'Backspace') { event.preventDefault(); deleteLast(); }
    else if (event.key === 'Escape' || event.key === 'Delete') { event.preventDefault(); clear(); }
  });
})();
