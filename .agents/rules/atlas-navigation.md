---
trigger: always_on
description: Use o Atlas como índice de navegação para evitar exploração desnecessária do projeto.
---

# Navegação inteligente do projeto

- Antes de explorar o código, consulte `atlas-map.md`, se existir.
- Utilize o Atlas como índice de navegação, não como substituto do código-fonte.
- Nunca leia todos os arquivos do projeto por padrão.
- Identifique os arquivos diretamente relacionados à tarefa.
- Faça buscas específicas, evitando varreduras desnecessárias.
- Antes de modificar um arquivo, leia seu conteúdo atual e as dependências relevantes.
- Não reanalise módulos que não tenham relação com a tarefa.
- Não faça dumps completos do banco de dados sem necessidade.
- Expanda a análise somente quando encontrar dependências relevantes.
- Se o mapa estiver desatualizado, regenere-o antes de utilizá-lo.
- Após alterações estruturais relevantes, atualize o mapa com `atlas . --budget 2048 > atlas-map.md`.
- Preserve a arquitetura, os padrões visuais e as convenções existentes.
