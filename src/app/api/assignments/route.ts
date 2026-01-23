/*
 * Assignments API Route
 * Assign courses or indexes to users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser, logActivity } from '@/lib/auth';

// GET - Get assignments for a user or course
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const courseId = searchParams.get('course_id');
    const indexId = searchParams.get('index_id');

    const supabase = createServerClient();

    // Get course assignments
    let courseAssignments: unknown[] = [];
    if (userId || courseId) {
      let query = supabase
        .from('course_assignments')
        .select(`
          *,
          course:courses(id, title, index:indexes(name)),
          user:users!course_assignments_user_id_fkey(id, username, full_name)
        `);

      if (userId) query = query.eq('user_id', userId);
      if (courseId) query = query.eq('course_id', courseId);
      query = query.eq('assigned_by', user.id);

      const { data } = await query;
      courseAssignments = data || [];
    }

    // Get index assignments
    let indexAssignments: unknown[] = [];
    if (userId || indexId) {
      let query = supabase
        .from('index_assignments')
        .select(`
          *,
          index:indexes(id, name),
          user:users!index_assignments_user_id_fkey(id, username, full_name)
        `);

      if (userId) query = query.eq('user_id', userId);
      if (indexId) query = query.eq('index_id', indexId);
      query = query.eq('assigned_by', user.id);

      const { data } = await query;
      indexAssignments = data || [];
    }

    return NextResponse.json({
      success: true,
      course_assignments: courseAssignments,
      index_assignments: indexAssignments,
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}


export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['trainer', 'crm'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_ids, course_id, index_id } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User IDs are required' },
        { status: 400 }
      );
    }

    if (!course_id && !index_id) {
      return NextResponse.json(
        { success: false, error: 'Course or Index ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify users are created by this user
    const { data: validUsers } = await supabase
      .from('users')
      .select('id')
      .in('id', user_ids)
      .eq('created_by', user.id);

    const validUserIds = validUsers?.map((u) => u.id) || [];

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid users found' },
        { status: 400 }
      );
    }

    let assignedCount = 0;

    if (course_id) {
      // Verify course ownership
      const { data: course } = await supabase
        .from('courses')
        .select('id, title, created_by')
        .eq('id', course_id)
        .single();

      if (!course || course.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Course not found or not owned' },
          { status: 400 }
        );
      }

      // Create course assignments
      const assignments = validUserIds.map((uid) => ({
        user_id: uid,
        course_id,
        assigned_by: user.id,
      }));

      const { data, error } = await supabase
        .from('course_assignments')
        .upsert(assignments, { onConflict: 'user_id,course_id' })
        .select();

      if (error) throw error;
      assignedCount = data?.length || 0;

      await logActivity(user.id, 'assigned_course', 'course', course_id, {
        user_count: assignedCount,
        course_title: course.title,
      });
    }

    if (index_id) {
      // Verify index ownership
      const { data: index } = await supabase
        .from('indexes')
        .select('id, name, created_by')
        .eq('id', index_id)
        .single();

      if (!index || index.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Index not found or not owned' },
          { status: 400 }
        );
      }

      // Create index assignments
      const assignments = validUserIds.map((uid) => ({
        user_id: uid,
        index_id,
        assigned_by: user.id,
      }));

      const { data, error } = await supabase
        .from('index_assignments')
        .upsert(assignments, { onConflict: 'user_id,index_id' })
        .select();

      if (error) throw error;
      assignedCount = data?.length || 0;

      await logActivity(user.id, 'assigned_index', 'index', index_id, {
        user_count: assignedCount,
        index_name: index.name,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Assigned to ${assignedCount} user(s)`,
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}

// DELETE - Remove assignment
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'course' or 'index'
    const userId = searchParams.get('user_id');
    const targetId = searchParams.get('target_id');

    if (!type || !userId || !targetId) {
      return NextResponse.json(
        { success: false, error: 'Type, user ID, and target ID are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (type === 'course') {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', targetId)
        .eq('assigned_by', user.id);

      if (error) throw error;
    } else if (type === 'index') {
      const { error } = await supabase
        .from('index_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('index_id', targetId)
        .eq('assigned_by', user.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
