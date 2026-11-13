import pool from './db.js';

async function updateSchema() {
  try {
    // 1. Add password to SCT_users if not exists
    const [cols] = await pool.query("SHOW COLUMNS FROM SCT_users LIKE 'password'");
    if (cols.length === 0) {
      console.log('Adding password column to SCT_users...');
      await pool.query("ALTER TABLE SCT_users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'sct@123' AFTER name");
      console.log('Password column added with default sct@123!');
    } else {
      console.log('Password column already exists.');
    }

    // 2. Add is_direct and post_permission to SCT_channels
    const [chanCols] = await pool.query("SHOW COLUMNS FROM SCT_channels LIKE 'post_permission'");
    if (chanCols.length === 0) {
      console.log('Adding post_permission and is_direct to SCT_channels...');
      await pool.query("ALTER TABLE SCT_channels ADD COLUMN is_direct TINYINT(1) NOT NULL DEFAULT 0 AFTER is_announcement");
      await pool.query("ALTER TABLE SCT_channels ADD COLUMN post_permission ENUM('all', 'admin_only', 'leaders_only') NOT NULL DEFAULT 'all' AFTER is_direct");
      // Set announcements to admin_only
      await pool.query("UPDATE SCT_channels SET post_permission = 'admin_only' WHERE is_announcement = 1");
      console.log('Channel columns added!');
    } else {
      console.log('Channel columns already exist.');
    }

    // A system announcement is visible in every workspace but only a Super Admin can post.
    const [globalAnnouncementCols] = await pool.query("SHOW COLUMNS FROM SCT_channels LIKE 'is_global_announcement'");
    if (globalAnnouncementCols.length === 0) {
      await pool.query("ALTER TABLE SCT_channels ADD COLUMN is_global_announcement TINYINT(1) NOT NULL DEFAULT 0 AFTER is_announcement");
      console.log('Added is_global_announcement column.');
    }

    const [teamLeaderCols] = await pool.query("SHOW COLUMNS FROM SCT_channels LIKE 'leader_user_id'");
    if (teamLeaderCols.length === 0) {
      await pool.query('ALTER TABLE SCT_channels ADD COLUMN leader_user_id INT NULL AFTER created_by');
      console.log('Added leader_user_id column for workspace teams.');
    }

    // 3. Ensure role enum has super_admin
    await pool.query(`
      ALTER TABLE SCT_users 
      MODIFY COLUMN role ENUM('super_admin', 'hod_admin', 'team_leader', 'member') NOT NULL DEFAULT 'member'
    `);

    // 4. Create SCT_workspaces if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS SCT_workspaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        icon VARCHAR(50) DEFAULT 'AVK',
        description TEXT NULL,
        head_user_id INT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_head_user (head_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Create SCT_workspace_members if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS SCT_workspace_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workspace_id INT NOT NULL,
        user_id INT NOT NULL,
        workspace_role ENUM('super_admin', 'workspace_head', 'team_leader', 'member') NOT NULL DEFAULT 'member',
        team_name VARCHAR(100) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_ws_user (workspace_id, user_id),
        INDEX idx_ws_user (user_id, workspace_id),
        FOREIGN KEY (workspace_id) REFERENCES SCT_workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES SCT_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Add workspace_id column to SCT_channels if not exists
    const [wsChanCols] = await pool.query("SHOW COLUMNS FROM SCT_channels LIKE 'workspace_id'");
    if (wsChanCols.length === 0) {
      await pool.query(`
        ALTER TABLE SCT_channels 
        ADD COLUMN workspace_id INT NOT NULL DEFAULT 1 AFTER id,
        ADD INDEX idx_workspace_id (workspace_id)
      `);
      console.log('Added workspace_id column to SCT_channels.');
    }

    // Channel names are unique inside a workspace, not across the whole organisation.
    const [channelIndexes] = await pool.query("SHOW INDEX FROM SCT_channels WHERE Non_unique = 0");
    const oldNameIndex = channelIndexes.find((index) => index.Column_name === 'name' && index.Key_name !== 'PRIMARY');
    if (oldNameIndex) {
      await pool.query(`ALTER TABLE SCT_channels DROP INDEX \`${oldNameIndex.Key_name}\`, ADD UNIQUE KEY unique_workspace_channel (workspace_id, name)`);
      console.log('Updated channel name uniqueness to workspace scope.');
    }

    // 7. Add is_global_broadcast column to SCT_messages if not exists
    const [msgCols] = await pool.query("SHOW COLUMNS FROM SCT_messages LIKE 'is_global_broadcast'");
    if (msgCols.length === 0) {
      await pool.query(`
        ALTER TABLE SCT_messages 
        ADD COLUMN is_global_broadcast TINYINT(1) NOT NULL DEFAULT 0 AFTER is_edited
      `);
      console.log('Added is_global_broadcast column to SCT_messages.');
    }

    // 8. Ensure the organisation workspaces and Master Admin exist.
    await pool.query(`
      INSERT INTO SCT_workspaces (id, name, slug, icon, description, head_user_id, created_by)
      VALUES (1, 'Sadhana Creation Team', 'sct', 'SCT', 'Sadhana Creation Team workspace', NULL, NULL)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), slug = VALUES(slug), icon = VALUES(icon),
        description = VALUES(description), head_user_id = VALUES(head_user_id)
    `);

    const workspaceDefinitions = [
      ['set', 'Spiritual Environment Team', 'SET'],
      ['ipt', 'Individual Progress Team', 'IPT'],
      ['cct', 'Course Creation Team', 'CCT'],
      ['bss', 'BSS', 'BSS']
    ];
    for (const [slug, name, icon] of workspaceDefinitions) {
      await pool.query(
        `INSERT INTO SCT_workspaces (name, slug, icon, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), description = VALUES(description)`,
        [name, slug, icon, `${name} workspace`]
      );
    }

    // There is exactly one organisation-wide Master Admin. All other permissions
    // are assigned per workspace through SCT_workspace_members.
    await pool.query(
      `INSERT INTO SCT_users (username, name, password, role, team_name, avatar)
       VALUES ('002', 'Super Admin', '002', 'super_admin', 'AVK', 'SA')
       ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password), role = 'super_admin', avatar = VALUES(avatar)`
    );
    await pool.query("UPDATE SCT_users SET role = 'member' WHERE username <> '002' AND role IN ('super_admin', 'hod_admin', 'team_leader')");

    // The supplied member lists are workspace-scoped. A person appears only in
    // their assigned workspace and therefore only sees those people in DMs.
    const memberDefinitions = [
      ['sct', [
        ['s112', 'Khush Maharaj', 'KM'], ['111', 'P Haripryaswami', 'PH'], ['112', 'P Swayamprakashswami', 'PS'],
        ['s120', 'Parthiv Maharaj', 'PM'], ['s108', 'Chintan Maharaj', 'CM'], ['114', 'P Hariprakashswami', 'HP'],
        ['115', 'P Haridarshanswami', 'HD'], ['s116', 'Abhishek Maharaj', 'AM'], ['s119', 'Jaydeep Maharaj', 'JM']
      ]],
      ['set', [
        ['64', 'P Gunnidhiswmai', 'PG'], ['108', 'P Sarvmangalswami', 'PS'], ['113', 'P Nimagnswami', 'PN'],
        ['s115', 'Sahaj M (2)', 'SM2'], ['s117', 'Dixit M', 'DM']
      ]],
      ['ipt', [
        ['Sail', 'Sail M', 'SM'], ['S_30', 'Neel M', 'NM'], ['Nirbhay', 'Nirbhay M', 'NM']
      ]],
      ['cct', [
        ['105', 'P Vinamraswami', 'PV'], ['s106', 'Ketul M', 'KM'], ['116', 'P Sweatdarshanswami', 'PS'],
        ['107', 'P Rajeshwarswami', 'PR'], ['s121', 'Ghanshyam M (2)', 'GM2'], ['s109', 'Sahdev M', 'SM']
      ]],
      ['bss', [
        ['s114', 'Darshan M', 'DM'], ['s113', 'Ghanshyam M (1)', 'GM1'], ['Savan', 'Savan M (Thoriya)', 'SM']
      ]]
    ];

    const [managedWorkspaces] = await pool.query("SELECT id FROM SCT_workspaces WHERE slug IN ('sct', 'set', 'ipt', 'cct', 'bss')");
    const managedWorkspaceIds = managedWorkspaces.map((workspace) => workspace.id);
    // The former organisation-wide announcement feature has been removed.
    // Delete every legacy system announcement, including any orphaned one left
    // behind by an old workspace deletion.
    await pool.query('DELETE FROM SCT_channels WHERE is_global_announcement = 1');
    if (managedWorkspaceIds.length) {
      await pool.query(`DELETE FROM SCT_workspace_members WHERE workspace_id IN (?)`, [managedWorkspaceIds]);
    }

    for (const [workspaceSlug, members] of memberDefinitions) {
      const [[workspace]] = await pool.query('SELECT id, name FROM SCT_workspaces WHERE slug = ?', [workspaceSlug]);
      for (const [username, name, avatar] of members) {
        await pool.query(
          `INSERT INTO SCT_users (username, name, password, role, team_name, avatar)
           VALUES (?, ?, ?, 'member', ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), avatar = VALUES(avatar), role = 'member'`,
          [username, name, username, workspace.name, avatar]
        );
        const [[member]] = await pool.query('SELECT id FROM SCT_users WHERE username = ?', [username]);
        await pool.query(
          `INSERT INTO SCT_workspace_members (workspace_id, user_id, workspace_role, team_name, is_default)
           VALUES (?, ?, 'member', ?, 1)`,
          [workspace.id, member.id, workspace.name]
        );
      }

    }

    console.log('Schema update complete!');
    process.exit(0);
  } catch (err) {
    console.error('Schema update failed:', err);
    process.exit(1);
  }
}
updateSchema();
