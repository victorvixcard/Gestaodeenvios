<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\Cenario;
use Tests\TestCase;

/**
 * Download em lote dos anexos da OS (zip). Pedido do Victor em 2026-08-23:
 * checkbox nos arquivos + botao para baixar varios de uma vez.
 */
class ArquivosZipTest extends TestCase
{
    use RefreshDatabase, Cenario;

    protected function setUp(): void
    {
        parent::setUp();
        $this->montarCenario();
        Storage::fake('public');
    }

    public function test_baixa_zip_dos_arquivos_selecionados(): void
    {
        $os = $this->criarOs($this->ana);

        foreach (['a.txt', 'b.txt', 'c.txt'] as $nome) {
            $this->como($this->ana)
                ->post("/api/orders/{$os->id}/files", [
                    'file' => UploadedFile::fake()->createWithContent($nome, "conteudo {$nome}"),
                ])->assertOk();
        }

        // Indices 0 e 2 -> a.txt e c.txt
        $res = $this->como($this->ana)->get("/api/orders/{$os->id}/files/zip?i=0,2");
        $res->assertOk();
        $this->assertSame('application/zip', $res->headers->get('content-type'));

        $tmp = tempnam(sys_get_temp_dir(), 'ziptest');
        file_put_contents($tmp, $res->streamedContent());
        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($tmp));
        $nomes = [];
        for ($n = 0; $n < $zip->numFiles; $n++) $nomes[] = $zip->getNameIndex($n);
        $zip->close();
        @unlink($tmp);

        $this->assertSame(['a.txt', 'c.txt'], $nomes);
    }

    public function test_sem_indice_vai_tudo_e_outra_empresa_nao_acessa(): void
    {
        $os = $this->criarOs($this->ana);
        $this->como($this->ana)
            ->post("/api/orders/{$os->id}/files", [
                'file' => UploadedFile::fake()->createWithContent('unico.txt', 'x'),
            ])->assertOk();

        $this->como($this->ana)->get("/api/orders/{$os->id}/files/zip")->assertOk();
        $this->como($this->diego)->get("/api/orders/{$os->id}/files/zip")->assertForbidden();
    }

    public function test_super_admin_exclui_anexos_selecionados_com_log(): void
    {
        $os = $this->criarOs($this->ana);
        foreach (['a.txt', 'b.txt', 'c.txt'] as $nome) {
            $this->como($this->ana)->post("/api/orders/{$os->id}/files", [
                'file' => UploadedFile::fake()->createWithContent($nome, 'x'),
            ])->assertOk();
        }

        // Empresa NAO exclui — solicita a VIXCard
        $this->como($this->ana)->deleteJson("/api/orders/{$os->id}/files?i=0")->assertForbidden();

        // Sem ?i nao exclui nada (protecao contra indice 0 acidental)
        $this->como($this->admin)->deleteJson("/api/orders/{$os->id}/files")->assertStatus(422);
        $this->assertCount(3, $os->fresh()->files);

        // Super admin exclui a.txt e c.txt; sobra b.txt
        $res = $this->como($this->admin)->deleteJson("/api/orders/{$os->id}/files?i=0,2")->assertOk();
        $nomes = array_column($res->json('files'), 'name');
        $this->assertSame(['b.txt'], $nomes);

        // Linha do tempo e auditoria registram
        $this->assertTrue(
            $os->fresh()->events()->where('description', 'like', '%excluído%')->exists()
        );
        $this->assertDatabaseHas('audit_logs', ['action' => 'pedido_anexo_excluido', 'entity_id' => $os->id]);
    }

    public function test_os_sem_arquivos_retorna_422(): void
    {
        $os = $this->criarOs($this->ana);
        $this->como($this->ana)->get("/api/orders/{$os->id}/files/zip")->assertStatus(422);
    }
}
