-- =====================================================================
-- SCRIPT DE ADIÇÃO DE FERIADOS E EXTENSÃO DE HORÁRIOS COMERCIAIS
-- =====================================================================
-- Este script adiciona suporte a feriados e estende horários comerciais para sábado/domingo
-- Copie e execute no MySQL Workbench
-- =====================================================================

-- =====================================================================
-- 1. CRIAR TABELA sla_feriados
-- =====================================================================
CREATE TABLE IF NOT EXISTS `sla_feriados` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID do feriado',
    `data` DATE NOT NULL UNIQUE COMMENT 'Data do feriado (YYYY-MM-DD)',
    `nome` VARCHAR(150) NOT NULL COMMENT 'Nome do feriado (ex: Natal, Ano Novo)',
    `descricao` TEXT NULL COMMENT 'Descrição do feriado',
    `ativo` BOOLEAN DEFAULT TRUE COMMENT 'Indica se o feriado está ativo',
    `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação',
    `atualizado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
    INDEX `idx_data` (`data`),
    INDEX `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Feriados para exclusão no cálculo de SLA';

-- =====================================================================
-- 2. ESTENDER TABELA sla_business_hours COM SÁBADO E DOMINGO
-- =====================================================================
-- Inserir sábado (5) e domingo (6) se não existirem
INSERT INTO `sla_business_hours` (
    `dia_semana`,
    `hora_inicio`,
    `hora_fim`,
    `ativo`
) VALUES
(5, '00:00', '00:00', FALSE),  -- Sábado (desativado por padrão)
(6, '00:00', '00:00', FALSE)   -- Domingo (desativado por padrão)
ON DUPLICATE KEY UPDATE
    `hora_inicio` = VALUES(`hora_inicio`),
    `hora_fim` = VALUES(`hora_fim`),
    `ativo` = VALUES(`ativo`);

-- =====================================================================
-- 3. ADICIONAR ALGUNS FERIADOS BRASILEIROS PADRÃO (EXEMPLO)
-- =====================================================================
-- Nota: Ajuste os anos conforme necessário
INSERT IGNORE INTO `sla_holidays` (
    `data`,
    `nome`,
    `descricao`,
    `ativo`
) VALUES
('2024-01-01', 'Ano Novo', 'Primeiro dia do ano', TRUE),
('2024-02-13', 'Terça de Carnaval', 'Terça anterior ao Dia de Cinzas', TRUE),
('2024-02-14', 'Quarta de Cinzas', 'Quarta de Cinzas - Carnaval', TRUE),
('2024-03-29', 'Sexta-feira Santa', 'Páscoa', TRUE),
('2024-04-21', 'Tiradentes', 'Inconfidência Mineira', TRUE),
('2024-05-01', 'Dia do Trabalho', 'Dia Internacional do Trabalho', TRUE),
('2024-06-20', 'Corpus Christi', 'Corpus Christi', TRUE),
('2024-09-07', 'Independência do Brasil', 'Dia da Independência', TRUE),
('2024-10-12', 'Nossa Senhora Aparecida', 'Padroeira do Brasil', TRUE),
('2024-11-02', 'Finados', 'Dia de Finados', TRUE),
('2024-11-20', 'Consciência Negra', 'Dia da Consciência Negra', TRUE),
('2024-12-25', 'Natal', 'Natal - Nascimento de Jesus', TRUE),
('2025-01-01', 'Ano Novo', 'Primeiro dia do ano', TRUE),
('2025-02-04', 'Terça de Carnaval', 'Terça anterior ao Dia de Cinzas', TRUE),
('2025-02-05', 'Quarta de Cinzas', 'Quarta de Cinzas - Carnaval', TRUE),
('2025-04-18', 'Sexta-feira Santa', 'Páscoa', TRUE),
('2025-04-21', 'Tiradentes', 'Inconfidência Mineira', TRUE),
('2025-05-01', 'Dia do Trabalho', 'Dia Internacional do Trabalho', TRUE),
('2025-06-09', 'Corpus Christi', 'Corpus Christi', TRUE),
('2025-09-07', 'Independência do Brasil', 'Dia da Independência', TRUE),
('2025-10-12', 'Nossa Senhora Aparecida', 'Padroeira do Brasil', TRUE),
('2025-11-02', 'Finados', 'Dia de Finados', TRUE),
('2025-11-20', 'Consciência Negra', 'Dia da Consciência Negra', TRUE),
('2025-12-25', 'Natal', 'Natal - Nascimento de Jesus', TRUE),
('2026-01-01', 'Ano Novo', 'Primeiro dia do ano', TRUE),
('2026-02-24', 'Terça de Carnaval', 'Terça anterior ao Dia de Cinzas', TRUE),
('2026-02-25', 'Quarta de Cinzas', 'Quarta de Cinzas - Carnaval', TRUE),
('2026-04-10', 'Sexta-feira Santa', 'Páscoa', TRUE),
('2026-04-21', 'Tiradentes', 'Inconfidência Mineira', TRUE),
('2026-05-01', 'Dia do Trabalho', 'Dia Internacional do Trabalho', TRUE),
('2026-05-29', 'Corpus Christi', 'Corpus Christi', TRUE),
('2026-09-07', 'Independência do Brasil', 'Dia da Independência', TRUE),
('2026-10-12', 'Nossa Senhora Aparecida', 'Padroeira do Brasil', TRUE),
('2026-11-02', 'Finados', 'Dia de Finados', TRUE),
('2026-11-20', 'Consciência Negra', 'Dia da Consciência Negra', TRUE),
('2026-12-25', 'Natal', 'Natal - Nascimento de Jesus', TRUE);

-- =====================================================================
-- 4. VERIFICAR DADOS INSERIDOS
-- =====================================================================
-- SELECT * FROM `sla_business_hours` ORDER BY `dia_semana` ASC;
-- SELECT COUNT(*) as total_feriados FROM `sla_holidays` WHERE `ativo` = TRUE AND `data` >= CURDATE();

-- =====================================================================
-- FIM DO SCRIPT
-- =====================================================================
-- Próximos passos:
-- 1. Executar este script no MySQL Workbench
-- 2. Verificar se a tabela sla_holidays foi criada com sucesso
-- 3. Atualizar os modelos Python do backend
-- 4. Atualizar endpoints da API
-- 5. Atualizar o frontend
-- =====================================================================
