# Homologação — QR Code de verificação da Proposta Avulsa

## Escopo e segurança

Este recurso **não gera QR Code Pix**. O QR do PDF aponta para a tela pública
`/proposta-avulsa/:token`, com token aleatório de 64 caracteres hexadecimais.
A página consulta `/public/standalone-proposals/:token` e o download utiliza
`/public/standalone-proposals/:token/pdf`.

O backend somente disponibiliza o arquivo oficial após verificar o SHA-256
registrado no banco de dados. **Não** publicar o diretório
`uploads/standalone-proposals` diretamente em Nginx ou outro servidor.
O aplicativo Express bloqueia a exposição por `/uploads/standalone-proposals`,
mas o proxy não deve contornar esse bloqueio com `alias` ou `root`.

## Pré-requisitos

1. Homologar primeiro em checkout separado da branch
   `feat/proposta-layout-editorial-modelo-20261111`. Não efetuar merge na
   `main` nem reiniciar o serviço existente durante o teste inicial.
2. Confirmar o hostname público exato do frontend e o endpoint da API. O host
   `sis.amazonikaengenharia.com.br` é uma referência presente na lista de
   origens permitidas do backend, **não prova** de que a implantação atual o usa.
3. O frontend precisa servir a rota React `/proposta-avulsa/:token` com
   fallback SPA para `index.html`. O proxy deve encaminhar as rotas
   `/public/standalone-proposals/` à API (diretamente ou com a tradução de
   prefixo correspondente ao `VITE_API_URL`).
4. Definir `PUBLIC_APP_URL=https://DOMINIO-REAL-DO-FRONTEND` no ambiente
   **do processo Node backend**, sem barra de caminho e com HTTPS. Na ausência,
   o backend tenta usar `FRONTEND_URL`; prefira configuração explícita.
5. Configurar `VITE_API_URL` **no build frontend** com a URL de API acessível
   pelo navegador. Essa variável é embutida pelo Vite na compilação.
6. Confirmar que `uploads/standalone-proposals` está em armazenamento
   persistente e compartilhado com o processo que realiza o download.
   O módulo existente grava o PDF em `process.cwd()/uploads/standalone-proposals`.
7. Manter um backup de banco e uploads antes de publicar qualquer versão.

## Testes locais e CI

```bash
# No diretório raiz do repositório clonado para homologação:
npm ci
npm run build

cd backend
npm ci
npx prisma generate
npx tsc --noEmit
node --require ts-node/register --test \
  src/modules/standalone-proposals/standalone-public-verification.test.ts

PUBLIC_APP_URL=https://example.org \
node --require ts-node/register --test \
  src/modules/standalone-proposals/standalone-proposal-pdf-layout.test.ts
```

Os testes devem verificar token desconhecido/inválido (404), proposta sem PDF
(404), PDF com SHA incompatível (409), documento válido (200) e download
binário idêntico. Devem também garantir 404 para
`/uploads/standalone-proposals/PAV-AAAA-NNNNNN.pdf`.

## Teste de homologação HTTP — sem divulgar tokens

Emitir uma **proposta de teste** pelo painel de homologação e ler o QR no PDF.
Usar o token dessa proposta apenas em terminal privado; não colá-lo em logs,
prints públicos ou issues.

```bash
# Ajustar os dois valores após confirmar o domínio e a API reais:
export FRONTEND_ORIGIN="https://DOMINIO-REAL-DO-FRONTEND"
export API_ORIGIN="https://DOMINIO-REAL-DA-API"

# Confirma que a rota SPA responde ao acesso direto no navegador:
curl -I "$FRONTEND_ORIGIN/proposta-avulsa/TOKEN-VALIDO-DE-TESTE"

# Conferir em navegador autenticado apenas pelo token do QR:
# $FRONTEND_ORIGIN/proposta-avulsa/TOKEN-VALIDO-DE-TESTE

# Controles negativos (sem token verdadeiro):
curl -i "$API_ORIGIN/public/standalone-proposals/invalido"
curl -i "$API_ORIGIN/uploads/standalone-proposals/PAV-2026-000008.pdf"
```

Resultado esperado: token inválido retorna 404, caminho estático retorna 404,
QR abre página pública e botão baixa o PDF original. Verificar também que
o domínio aceita HTTPS válido e que a API permite o CORS do frontend.

Para verificar a integridade do arquivo baixado, comparar `sha256sum`
(ou `shasum -a 256`) com o campo `sha256` retornado pela consulta pública.

**Não** testar download com token real em serviços externos de encurtamento,
monitoramento ou rastreamento de links, pois isso compartilha o token.

## Checklist antes da publicação

- [ ] PR revisado; testes de frontend e backend aprovados.
- [ ] `PUBLIC_APP_URL` e `VITE_API_URL` configurados de acordo com os
      endereços efetivos.
- [ ] `PUBLIC_APP_URL` usa HTTPS, sem URL local.
- [ ] Nginx não oferece `uploads/standalone-proposals` diretamente.
- [ ] Revisão de CORS, proxy reverso e fallback SPA.
- [ ] Banco e uploads persistentes com backup.
- [ ] PDF gerado, QR decodificado e página aberta em celular fora da rede.
- [ ] Download validado com SHA-256.
- [ ] Proposta sem PDF e token inválido retornam 404.
- [ ] Arquivo adulterado retorna 409, sem download.
- [ ] Plano de rollback definido.

## Rollback

O código de QR e da página pública deve ser revertido por deploy da revisão
anterior, preservando o banco e os PDFs gerados. Não é necessária migração
Prisma: o modelo `StandaloneProposal` já possui `publicToken` único.
Se o backend recuar para a versão antiga, novos QR codes só voltarão a
funcionar após a nova publicação. Registre a versão publicada para permitir
retorno rápido.
