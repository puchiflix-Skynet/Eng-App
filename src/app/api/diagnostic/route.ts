import { NextResponse } from 'next/server';
import {
  symptomsData,
  decisionTreeData,
  troubleshootingStepsData,
  escalationMatrixData
} from '@/data/knowledgeBase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const issueId = searchParams.get('issueId');

  if (type === 'symptoms') {
    return NextResponse.json(symptomsData);
  }

  if (type === 'tree' && issueId) {
    const tree = decisionTreeData.find(t => t.issueId === issueId);
    return NextResponse.json(tree || null);
  }

  if (type === 'steps' && issueId) {
    const steps = troubleshootingStepsData.filter(s => s.issueId === issueId);
    return NextResponse.json(steps);
  }

  if (type === 'escalation' && issueId) {
    const matrix = escalationMatrixData.find(e => e.issueId === issueId);
    return NextResponse.json(matrix || null);
  }

  return NextResponse.json({ error: 'Invalid type or missing issueId' }, { status: 400 });
}
