import {
  createContentEditorRegistry,
  createEditorHandoff,
  descriptorToEditorRegistration,
  selectEditorsForIntent,
  summarizeEditorAlignment,
} from "../one/packages/editor.core/src/index.ts";
import { REAKTOR_CONTENT_EDITOR } from "../reaktor/reaktor.core/src/editorDescriptor.ts";
import { VGER_TXT_CONTENT_EDITOR } from "../vger/packages/vger.txt.ui/src/editorDescriptor.ts";

const editorRegistry = createContentEditorRegistry([
  REAKTOR_CONTENT_EDITOR,
  VGER_TXT_CONTENT_EDITOR,
]);

export function createProjectEditorWorkbench(projectId = "demo-kita-2028") {
  const briefEditors = selectEditorsForIntent(editorRegistry, { contentKind: "brief" });
  const documentEditors = selectEditorsForIntent(editorRegistry, {
    contentKind: "document",
    requiredCapabilities: ["document-assembly"],
  });
  const briefEditor = requireEditor(briefEditors, "brief");
  const documentEditor = requireEditor(documentEditors, "document");
  const handoffs = [
    createEditorHandoff({
      editor: briefEditor,
      projectId,
      sourceRef: `/${projectId}/flows/lp3-entscheidung`,
      title: "LP3-Entscheidungsvorlage",
      contentKind: "brief",
      phase: "LP3",
    }),
    createEditorHandoff({
      editor: documentEditor,
      projectId,
      sourceRef: `/${projectId}/flows/genehmigungsmappe`,
      title: "Genehmigungsmappe",
      contentKind: "document",
      phase: "LP4",
    }),
  ];

  return {
    registry: editorRegistry,
    registrations: editorRegistry.editors.map((editor) => descriptorToEditorRegistration(editor, 1780402500000)),
    alignmentModules: summarizeEditorAlignment(editorRegistry.editors),
    handoffs,
  };
}

function requireEditor(editors, contentKind) {
  if (editors.length === 0) {
    throw new Error(`No editor registered for ${contentKind}`);
  }
  return editors[0];
}
