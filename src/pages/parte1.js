import { writeFileSync } from 'fs'

const p1 = `import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Negociacao = {
  id: string; nome: string; telefone: string; instagram: string
  modelo: string; cor: string; valor_aparelho: number; valor_entrada: number
  parcelas: number; taxa: number; valor_parcela: number; valor_total: number
  observacoes: string; status: string; vendedor: string; created_at: string
}

type Aparelho = {
  id: string; modelo: string; cores: string[]; fotos: Record<string, string[]>
}

const TAXAS = [
  { label: 'A vista', parcelas: 1, taxa: 4.10 },
  { label: '2x', parcelas: 2, taxa: 5.37 },
  { label: '3x', parcelas: 3, taxa: 6.25 },
  { label: '4x', parcelas: 4, taxa: 7.13 },
  { label: '5x', parcelas: 5, taxa: 8.01 },
  { label: '6x', parcelas: 6, taxa: 8.89 },
  { label: '7x', parcelas: 7, taxa: 9.77 },
  { label: '8x', parcelas: 8, taxa: 10.65 },
  { label: '9x', parcelas: 9, taxa: 11.53 },
  { label: '10x', parcelas: 10, taxa: 12.41 },
  { label: '11x', parcelas: 11, taxa: 13.29 },
  { label: '12x', parcelas: 12, taxa: 14.17 },
  { label: '13x', parcelas: 13, taxa: 15.05 },
  { label: '14x', parcelas: 14, taxa: 15.93 },
  { label: '15x', parcelas: 15, taxa: 16.81 },
  { label: '16x', parcelas: 16, taxa: 17.69 },
  { label: '17x', parcelas: 17, taxa: 18.57 },
  { label: '18x', parcelas: 18, taxa: 19.45 },
]

const CORES_LISTA = [
  { nome: 'Preto', hex: '#1a1a1a' },
  { nome: 'Branco', hex: '#f0f0f0' },
  { nome: 'Vermelho (RED)', hex: '#cc0000' },
  { nome: 'Estelar', hex: '#f5e6c8' },
  { nome: 'Meia-Noite', hex: '#1c2026' },
  { nome: 'Titânio Natural', hex: '#c4b49a' },
  { nome: 'Titânio Preto', hex: '#2c2c2c' },
  { nome: 'Titânio Branco', hex: '#e8e4dc' },
  { nome: 'Titânio Desert', hex: '#c8a97a' },
  { nome: 'Titânio Rosa', hex: '#e8b4a0' },
  { nome: 'Azul', hex: '#4a90d9' },
  { nome: 'Azul Sierra', hex: '#5b7fa6' },
  { nome: 'Azul Alpino', hex: '#2d5f8a' },
  { nome: 'Verde', hex: '#5ab878' },
  { nome: 'Verde Alpino', hex: '#4a7c59' },
  { nome: 'Verde Floresta', hex: '#2d5c3a' },
  { nome: 'Rosa', hex: '#e8799e' },
  { nome: 'Roxo', hex: '#7b5ea7' },
  { nome: 'Violeta', hex: '#9b59b6' },
  { nome: 'Amarelo', hex: '#f5c842' },
  { nome: 'Coral', hex: '#ff6b5b' },
  { nome: 'Laranja', hex: '#ff8c00' },
  { nome: 'Ciano', hex: '#00bcd4' },
  { nome: 'Dourado', hex: '#c9a84c' },
  { nome: 'Prateado', hex: '#b0b8c1' },
  { nome: 'Grafite', hex: '#4a4a4a' },
  { nome: 'Azul Pacífico', hex: '#1a4a6b' },
  { nome: 'Luz das Estrelas', hex: '#f0e8d0' },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Negociacao() {
  const [aba, setAba] = useState<'negociacao' | 'clientes' | 'relatorios' | 'admin'>('negociacao')
  const [menuAberto, setMenuAberto] = useState(false)
  const [clientes, setClientes] = useState<Negociacao[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Negociacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<number | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([])
  const [buscaModelo, setBuscaModelo] = useState('')
  const [modeloSugestoes, setModeloSugestoes] = useState<Aparelho[]>([])
  const [filtro, setFiltro] = useState('Todos')
  const [form, setForm] = useState({
    nome: '', telefone: '', instagram: '',
    modelo: '', cor: '',
    valor_aparelho: '', valor_entrada: '',
    observacoes: '', vendedor: '',
  })

  // Admin states
  const [adminModelo, setAdminModelo] = useState('')
  const [adminCoresSelecionadas, setAdminCoresSelecionadas] = useState<string[]>([])
  const [adminCorAtiva, setAdminCorAtiva] = useState<string | null>(null)
  const [adminFotos, setAdminFotos] = useState<Record<string, string[]>>({})
  const [adminSalvando, setAdminSalvando] = useState(false)
  const [aparelhoEditandoId, setAparelhoEditandoId] = useState<string | null>(null)

  useEffect(() => {
    if (aba === 'clientes' || aba === 'relatorios') carregarClientes()
    if (aba === 'negociacao' || aba === 'admin') carregarAparelhos()
  }, [aba])

  async function carregarClientes() {
    const { data } = await supabase.from('negociacoes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
  }

  async function carregarAparelhos() {
    const { data } = await supabase.from('aparelhos').select('*').order('modelo')
    setAparelhos(data || [])
  }

  function buscarModelo(texto: string) {
    setBuscaModelo(texto)
    setForm({ ...form, modelo: texto, cor: '' })
    if (texto.length < 2) { setModeloSugestoes([]); return }
    const sugestoes = aparelhos.filter(a => a.modelo.toLowerCase().includes(texto.toLowerCase()))
    setModeloSugestoes(sugestoes)
  }

  function selecionarAparelho(a: Aparelho) {
    setBuscaModelo(a.modelo)
    setForm({ ...form, modelo: a.modelo, cor: '' })
    setModeloSugestoes([])
  }

  function toggleCorAdmin(nome: string) {
    setAdminCoresSelecionadas(prev =>
      prev.includes(nome) ? prev.filter(c => c !== nome) : [...prev, nome]
    )
    if (!adminCoresSelecionadas.includes(nome)) setAdminCorAtiva(nome)
  }

  async function uploadFoto(file: File, modelo: string, cor: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = \`aparelhos/\${modelo.replace(/\\s+/g, '_')}/\${cor.replace(/\\s+/g, '_')}_\${Date.now()}.\${ext}\`
    const { error } = await supabase.storage.from('fotos').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('fotos').getPublicUrl(path)
    return data.publicUrl
  }

  async function salvarAparelho() {
    if (!adminModelo.trim()) { alert('Digite o modelo!'); return }
    if (adminCoresSelecionadas.length === 0) { alert('Selecione pelo menos uma cor!'); return }
    setAdminSalvando(true)
    try {
      const fotosUrls: Record<string, string[]> = {}
      for (const cor of adminCoresSelecionadas) {
        const arquivos = adminFotos[cor] || []
        const urls: string[] = []
        for (const dataUrl of arquivos) {
          if (dataUrl.startsWith('http')) { urls.push(dataUrl); continue }
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          const file = new File([blob], 'foto.jpg', { type: blob.type })
          const url = await uploadFoto(file, adminModelo, cor)
          urls.push(url)
        }
        fotosUrls[cor] = urls
      }
      const dados = { modelo: adminModelo, cores: adminCoresSelecionadas, fotos: fotosUrls }
      if (aparelhoEditandoId) {
        await supabase.from('aparelhos').update(dados).eq('id', aparelhoEditandoId)
      } else {
        await supabase.from('aparelhos').insert([dados])
      }
      alert(aparelhoEditandoId ? 'Aparelho atualizado!' : 'Aparelho cadastrado!')
      setAdminModelo(''); setAdminCoresSelecionadas([]); setAdminCorAtiva(null)
      setAdminFotos({}); setAparelhoEditandoId(null)
      carregarAparelhos()
    } catch(e: any) {
      alert('Erro: ' + e.message)
    }
    setAdminSalvando(false)
  }

  function editarAparelho(a: Aparelho) {
    setAdminModelo(a.modelo)
    setAdminCoresSelecionadas(a.cores)
    setAdminFotos(a.fotos || {})
    setAdminCorAtiva(a.cores[0] || null)
    setAparelhoEditandoId(a.id)
  }

  async function excluirAparelho(id: string) {
    if (!confirm('Excluir este aparelho?')) return
    await supabase.from('aparelhos').delete().eq('id', id)
    carregarAparelhos()
  }

  const taxaAtual = TAXAS.find(t => t.parcelas === parcelaSelecionada) || TAXAS[0]
  const valorAparelho = parseFloat(form.valor_aparelho.replace(',', '.')) || 0
  const valorEntrada = parseFloat(form.valor_entrada.replace(',', '.')) || 0
  const valorFinanciar = Math.max(0, valorAparelho - valorEntrada)
  const valorComTaxa = parcelaSelecionada ? valorFinanciar / (1 - taxaAtual.taxa / 100) : valorFinanciar
  const valorParcela = !parcelaSelecionada ? 0 : parcelaSelecionada === 1 ? valorComTaxa : valorComTaxa / parcelaSelecionada
  const valorTotal = valorComTaxa + valorEntrada

  function validar() {
    const e: Record<string, string> = {}
    if (!form.nome.trim()) e.nome = 'Nome do cliente obrigatorio'
    if (!form.telefone.trim()) e.telefone = 'WhatsApp obrigatorio'
    if (!form.vendedor.trim()) e.vendedor = 'Nome do vendedor obrigatorio'
    if (!valorAparelho) e.valor_aparelho = 'Valor obrigatorio'
    if (!parcelaSelecionada) e.parcelas = 'Selecione o parcelamento'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(status: string) {
    if (!validar()) return
    setSalvando(true)
    const dados = {
      nome: form.nome, telefone: form.telefone, instagram: form.instagram,
      modelo: form.modelo, cor: form.cor,
      valor_aparelho: valorAparelho, valor_entrada: valorEntrada,
      parcelas: parcelaSelecionada, taxa: taxaAtual.taxa,
      valor_parcela: valorParcela, valor_total: valorTotal,
      observacoes: form.observacoes, vendedor: form.vendedor, status,
    }
    let error
    if (editandoId) {
      const res = await supabase.from('negociacoes').update(dados).eq('id', editandoId)
      error = res.error
    } else {
      const res = await supabase.from('negociacoes').insert([dados])
      error = res.error
    }
    setSalvando(false)
    if (error) { alert('Erro: ' + JSON.stringify(error)); return }
    alert(editandoId ? 'Negociacao atualizada!' : 'Negociacao salva!')
    limpar()
  }

  function limpar() {
    setForm({ nome: '', telefone: '', instagram: '', modelo: '', cor: '', valor_aparelho: '', valor_entrada: '', observacoes: '', vendedor: '' })
    setParcelaSelecionada(null)
    setErros({})
    setEditandoId(null)
    setBuscaModelo('')
  }

  function editarNegociacao(c: Negociacao) {
    setForm({
      nome: c.nome, telefone: c.telefone, instagram: c.instagram || '',
      modelo: c.modelo || '', cor: c.cor || '',
      valor_aparelho: String(c.valor_aparelho), valor_entrada: String(c.valor_entrada || 0),
      observacoes: c.observacoes || '', vendedor: c.vendedor || '',
    })
    setBuscaModelo(c.modelo || '')
    setParcelaSelecionada(c.parcelas)
    setEditandoId(c.id)
    setClienteSelecionado(null)
    setAba('negociacao')
  }

  async function alterarStatus(id: string, status: string) {
    await supabase.from('negociacoes').update({ status }).eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }

  async function excluirNegociacao(id: string) {
    if (!confirm('Excluir esta negociacao?')) return
    await supabase.from('negociacoes').delete().eq('id', id)
    carregarClientes(); setClienteSelecionado(null)
  }
`

writeFileSync('src/pages/Negociacao.tsx', p1, 'utf8')
console.log('parte 1 ok')