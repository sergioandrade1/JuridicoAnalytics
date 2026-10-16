// Regras puras do modulo financeiro (sem DOM nem Firebase), para poderem ser
// testadas em Node. Carrega antes do script inline do index.html.

// Plano de Contas = aba "Plano de Contas" da planilha Fluxo de Caixa 2026.
// Para mudar uma conta, edite aqui (o codigo antes do " - " e a chave).
const FIN_PLANO = [
  {"grupo": "Receitas Diretas", "tipo": "Entrada", "contas": ["1.01.01 - Consultoria jurídicas para empresas", "1.01.02 - Honorários - Atuação Pontual Contenciosa", "1.01.03 - Honorários - Êxito", "1.01.04 - Honorários - Mensal", "1.01.05 - Honorários - Negociação Coletiva", "1.01.06 - Honorários - Sucumbênciais"]},
  {"grupo": "Entradas Não Operacionais", "tipo": "Entrada", "contas": ["1.02.01 - Aporte de Sócio", "1.02.02 - Recebimento Indevido", "1.02.03 - Conta Garantida"]},
  {"grupo": "Recuperações e Rendimentos", "tipo": "Entrada", "contas": ["1.03.01 - Devolução de Compra/Estorno de Despesa", "1.03.02 - Reembolso", "1.03.03 - Rendimento"]},
  {"grupo": "Receitas em Espécie", "tipo": "Entrada", "contas": ["1.04.01 - Honorários - Recebimento em Espécie"]},
  {"grupo": "Despesas Administrativas", "tipo": "Saída", "contas": ["2.01.001 - Água e Esgoto", "2.01.002 - Confraternização e Brindes", "2.01.003 - Contabilidade", "2.01.004 - Contratação de Temporário", "2.01.005 - Copa e cozinha", "2.01.006 - Depreciação equipamentos", "2.01.007 - Deslocamento / Uber / Outros", "2.01.008 - Energia Elétrica", "2.01.009 - Eventos Corporativos", "2.01.010 - Fretes e Transportes", "2.01.011 - Informática - Equipamentos", "2.01.012 - Informática - Software", "2.01.013 - Internet", "2.01.014 - Locação de Equipamentos", "2.01.015 - Material de Escritório", "2.01.016 - Material de Limpeza (Higiene e descartáveis)", "2.01.017 - Material para Manutenção e Reformas", "2.01.018 - Monitoramento e Segurança", "2.01.019 - OAB Anuidade", "2.01.020 - OAB Taxas", "2.01.021 - Prestação de Serviços", "2.01.022 - Propaganda/Anúncio Publicitário", "2.01.023 - Mão de Obra e Manutenção", "2.01.024 - Site", "2.01.025 - Telefonia e Comunicação", "2.01.026 - Patrocínio"]},
  {"grupo": "Custos Operacionais (Sócios)", "tipo": "Saída", "contas": ["2.02.001 - Parceria Jurídica", "2.02.002 - Honorários Fixos", "2.02.003 - Sergio Aquino - ITAÚ Conta PF", "2.02.004 - Sergio Aquino - ITAÚ Conta Poupança PF", "2.02.005 - Sergio Aquino - ITAÚ Personnalité PF"]},
  {"grupo": "Custos com Clientes", "tipo": "Saída", "contas": ["2.03.001 - Combustível", "2.03.002 - Custas Processuais", "2.03.003 - Hospedagem", "2.03.004 - Passagens", "2.03.005 - Reembolso", "2.03.006 - Contratação Juridica Pontual"]},
  {"grupo": "Despesas Pessoal", "tipo": "Saída", "contas": ["2.04.001 - 13º Salário", "2.04.002 - Assistência Médica", "2.04.003 - Bolsa Estágio", "2.04.004 - Bonificação", "2.04.005 - Cursos e Treinamentos", "2.04.006 - Desligamentos", "2.04.007 - Exames Médicos", "2.04.008 - Fardamento e Uniforme", "2.04.009 - Férias", "2.04.010 - FGTS", "2.04.011 - INSS", "2.04.012 - IRRF", "2.04.013 - Pró-labore", "2.04.014 - Salários", "2.04.015 - Vale Refeição", "2.04.016 - Vale Transporte", "2.04.017 - Premiação/Gratificação"]},
  {"grupo": "Despesas Financeiras / Bancos", "tipo": "Saída", "contas": ["2.05.001 - IOF", "2.05.002 - Juros", "2.05.003 - Tarifas Bancárias", "2.05.004 - Amortização"]},
  {"grupo": "Impostos e Taxas", "tipo": "Saída", "contas": ["2.06.001 - CIM", "2.06.002 - COFINS", "2.06.003 - CSLL", "2.06.004 - CSRF", "2.06.005 - IRPJ", "2.06.006 - ISS", "2.06.007 - PIS", "2.06.008 - IPVA", "2.06.009 - IPTU", "2.06.010 - Taxas diversas"]},
  {"grupo": "Investimento", "tipo": "Saída", "contas": ["2.07.001 - Aplicações e Investimentos", "2.07.002 - Máquinas e Equipamentos", "2.07.003 - Móveis e Utensílios."]},
  {"grupo": "Outras Saídas", "tipo": "Saída", "contas": ["2.08.001 - Despesas Diversas-PF Sergio", "2.08.002 - Estorno de pagamento"]}
];

const FIN_CONTAS = FIN_PLANO.reduce((acc, g) => acc.concat(g.contas), []);

// Contas 1.* sao entradas e 2.* saidas (mesma regra da coluna "Tipo no Fluxo").
function finTipoDaConta(conta) {
    const c = String(conta || '').trim();
    if (c.indexOf('1.') === 0) return 'Entrada';
    if (c.indexOf('2.') === 0) return 'Saída';
    return null;
}

// Efeito do tipo no saldo corrente. Como na planilha, so Entrada (+) e Saida (-)
// movimentam o saldo; Repasse, Despesa Conta PF, Recebimento Repasse e Especie
// sao pernas de controle e ficam fora (0).
function finSinal(tipo) {
    if (tipo === 'Entrada') return 1;
    if (tipo === 'Saída') return -1;
    return 0;
}

// Saldo corrente em ordem cronologica (data; empate mantem a ordem recebida).
// Retorna { ordem: [lancamentos], saldos: {id: saldo}, entradas, saidas, saldoFinal }.
function finCalcSaldos(lancamentos, saldoInicial) {
    const ordem = (lancamentos || [])
        .map((l, i) => ({ l: l, i: i }))
        .sort((a, b) => String(a.l.data).localeCompare(String(b.l.data)) || a.i - b.i)
        .map(x => x.l);
    let saldo = Number(saldoInicial) || 0, entradas = 0, saidas = 0;
    const saldos = {};
    ordem.forEach(l => {
        const v = Math.abs(Number(l.valor) || 0) * finSinal(l.tipo);
        if (v > 0) entradas += v; else saidas -= v;
        saldo = Math.round((saldo + v) * 100) / 100;
        saldos[l.id] = saldo;
    });
    return { ordem: ordem, saldos: saldos, entradas: entradas, saidas: saidas, saldoFinal: saldo };
}

// Codigo da conta = texto antes do " - " ("2.01.008 - Energia Elétrica" -> "2.01.008").
// Casar pelo codigo tolera espaco a mais ou acento trocado em lancamentos importados.
function finCodigoConta(conta) {
    return String(conta || '').split(' - ')[0].trim();
}

// Tipos que a planilha soma em cada familia de conta (formulas SUMPRODUCT da aba
// "Fluxo de Caixa Mensal"): 1.01-1.03 Entrada; 1.04 Especie; 2.* Saida e
// Recebimento Repasse. Lancamento com outro tipo nao entra na linha nem nos totais.
function finTipoCasaConta(codigo, tipo) {
    if (/^1\.0[123]\./.test(codigo)) return tipo === 'Entrada';
    if (codigo.indexOf('1.04.') === 0) return tipo === 'Espécie';
    if (codigo.indexOf('2.') === 0) return tipo === 'Saída' || tipo === 'Recebimento Repasse';
    return false;
}

// Fluxo de Caixa Mensal: uma linha por conta do plano, uma coluna por mes.
// Cada celula soma os valores absolutos da conta no mes, so dos tipos que a
// planilha soma (finTipoCasaConta). Total de entradas = contas 1.01-1.03; total
// de saidas = contas 2.*; saldo = anterior + entradas - saidas (como na planilha).
// O que nao casa (conta fora do plano ou tipo incompativel, ex.: tipo vazio) vai
// para "Fora do plano / tipo incompatível": aparece, mas nao entra nos totais.
function finFluxoMensal(lancamentos, saldoInicial) {
    const zeros = () => new Array(12).fill(0);
    const grupos = FIN_PLANO.map(g => ({
        grupo: g.grupo, tipo: g.tipo, total: zeros(),
        contas: g.contas.map(c => ({ conta: c, codigo: finCodigoConta(c), valores: zeros(), total: 0 }))
    }));
    const porCodigo = {};
    grupos.forEach(g => g.contas.forEach(c => { porCodigo[c.codigo] = { g: g, c: c }; }));
    const fora = { grupo: 'Fora do plano / tipo incompatível', tipo: '', total: zeros(), contas: [] };
    const resumo = Array.from({ length: 12 }, () => ({ entradas: 0, saidas: 0, resultado: 0, saldoInicial: 0, saldoFinal: 0 }));

    (lancamentos || []).forEach(l => {
        const m = Number(l.mes) - 1;
        if (!(m >= 0 && m < 12)) return;
        const valor = Math.abs(Number(l.valor) || 0);
        const codigo = finCodigoConta(l.categoria);
        let alvo = porCodigo[codigo];
        if (alvo && finTipoCasaConta(codigo, l.tipo)) {
            if (codigo.indexOf('1.0') === 0 && codigo.indexOf('1.04.') !== 0) resumo[m].entradas += valor;
            else if (codigo.indexOf('2.') === 0) resumo[m].saidas += valor;
        } else {
            const nome = (String(l.categoria || '').trim() || '(sem conta)') + (alvo ? ' · tipo ' + (l.tipo || 'vazio') : '');
            let c = fora.contas.find(x => x.conta === nome);
            if (!c) { c = { conta: nome, codigo: codigo, valores: zeros(), total: 0 }; fora.contas.push(c); }
            alvo = { g: fora, c: c };
        }
        alvo.c.valores[m] += valor;
        alvo.g.total[m] += valor;
    });

    let saldo = Number(saldoInicial) || 0;
    resumo.forEach(r => {
        r.saldoInicial = saldo;
        r.resultado = Math.round((r.entradas - r.saidas) * 100) / 100;
        saldo = Math.round((saldo + r.resultado) * 100) / 100;
        r.saldoFinal = saldo;
    });
    if (fora.contas.length) grupos.push(fora);
    grupos.forEach(g => g.contas.forEach(c => { c.total = c.valores.reduce((a, b) => a + b, 0); }));
    return { grupos: grupos, resumo: resumo };
}

// Controle da Conta Garantida (aba "Controle Conta Garantida" da planilha):
// registros = [{id, data 'AAAA-MM-DD', mes, saldo}] com o saldo devedor do dia.
// Variacao = saldo - saldo anterior (o primeiro compara com o devedor inicial).
// Saldo do mes = ultimo registro do mes. Reducao do mes = saldo do mes anterior
// menos o do mes (janeiro parte do inicial); so existe se os dois meses tem registro.
function finGarantiaResumo(registros, inicial) {
    const ordem = (registros || []).map((r, i) => ({ r: r, i: i }))
        .sort((a, b) => String(a.r.data).localeCompare(String(b.r.data)) || a.i - b.i).map(x => x.r);
    const ini = Number(inicial) || 0;
    const variacoes = {};
    let ant = ini;
    ordem.forEach(r => { variacoes[r.id] = Math.round((Number(r.saldo) - ant) * 100) / 100; ant = Number(r.saldo); });
    const meses = Array.from({ length: 12 }, () => ({ saldoFinal: null, reducao: null }));
    ordem.forEach(r => { const m = Number(r.mes) - 1; if (m >= 0 && m < 12) meses[m].saldoFinal = Number(r.saldo); });
    meses.forEach((x, m) => {
        const base = m === 0 ? ini : meses[m - 1].saldoFinal;
        if (x.saldoFinal != null && base != null) x.reducao = Math.round((base - x.saldoFinal) * 100) / 100;
    });
    return { ordem: ordem, variacoes: variacoes, meses: meses, atual: ordem.length ? Number(ordem[ordem.length - 1].saldo) : ini };
}

// Le a aba "Controle Conta Garantida" ja convertida em linhas (matriz). Acha o
// devedor inicial ("Saldo Devedor Inicial", valor na coluna seguinte) e os
// registros abaixo do cabecalho ("Data" ... "Saldo do Dia"). Datas podem ser
// Date ou texto dd/mm/aaaa (as primeiras linhas da planilha real sao texto).
// Datas repetidas: vale a ultima, como o LOOKUP da planilha.
function finGarantiaParse(rows) {
    const norm = v => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const toDate = v => {
        if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
        const t = String(v == null ? '' : v).trim();
        let m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (m) return new Date(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    };
    const num = v => {
        if (typeof v === 'number') return v;
        const n = parseFloat(String(v == null ? '' : v).replace(/[R$\s.]/g, '').replace(',', '.'));
        return isFinite(n) ? n : null;
    };
    let inicial = null, cabecalho = -1;
    (rows || []).forEach((r, i) => {
        const a = norm(r && r[0]);
        if (a.indexOf('saldo devedor inicial') === 0 && inicial == null) inicial = num(r[1]);
        if (cabecalho < 0 && a === 'data' && (r || []).some(c => norm(c).indexOf('saldo do dia') === 0)) cabecalho = i;
    });
    const porData = {}, ignoradas = [];
    if (cabecalho >= 0) {
        const colSaldo = rows[cabecalho].findIndex(c => norm(c).indexOf('saldo do dia') === 0);
        const colObs = rows[cabecalho].findIndex(c => norm(c).indexOf('observa') === 0);
        for (let i = cabecalho + 1; i < rows.length; i++) {
            const r = rows[i] || [];
            const d = toDate(r[0]), saldo = num(r[colSaldo]);
            if (!d || saldo == null) { if (r[0] != null && r[0] !== '') ignoradas.push(i + 1); continue; }
            const pad = n => String(n).padStart(2, '0');
            const data = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
            porData[data] = { data: data, ano: d.getFullYear(), mes: d.getMonth() + 1, saldo: saldo, obs: colObs >= 0 ? String(r[colObs] == null ? '' : r[colObs]).trim() : '' };
        }
    }
    const registros = Object.keys(porData).sort().map(k => porData[k]);
    return { inicial: inicial, registros: registros, ignoradas: ignoradas, achouCabecalho: cabecalho >= 0 };
}

if (typeof module !== 'undefined') {
    module.exports = { FIN_PLANO, FIN_CONTAS, finTipoDaConta, finSinal, finCalcSaldos, finCodigoConta, finTipoCasaConta, finFluxoMensal, finGarantiaResumo, finGarantiaParse };
}
