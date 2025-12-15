"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add all missing columns to shifts table
    const addManagerId = async () => {
      try {
        await queryInterface.addColumn("shifts", "manager_id", {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "users",
            key: "id"
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          // Column already exists, skip
          console.warn('Column manager_id already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addReadingsCount = async () => {
      try {
        await queryInterface.addColumn("shifts", "readings_count", {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column readings_count already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addTotalLitresSold = async () => {
      try {
        await queryInterface.addColumn("shifts", "total_litres_sold", {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column total_litres_sold already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addTotalSalesAmount = async () => {
      try {
        await queryInterface.addColumn("shifts", "total_sales_amount", {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column total_sales_amount already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addStatus = async () => {
      try {
        await queryInterface.addColumn("shifts", "status", {
          type: Sequelize.ENUM('active', 'ended', 'cancelled'),
          allowNull: true,
          defaultValue: 'active'
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column status already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addEndedBy = async () => {
      try {
        await queryInterface.addColumn("shifts", "ended_by", {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "users",
            key: "id"
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column ended_by already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addNotes = async () => {
      try {
        await queryInterface.addColumn("shifts", "notes", {
          type: Sequelize.TEXT,
          allowNull: true
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column notes already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    const addEndNotes = async () => {
      try {
        await queryInterface.addColumn("shifts", "end_notes", {
          type: Sequelize.TEXT,
          allowNull: true
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          console.warn('Column end_notes already exists, skipping');
        } else {
          throw err;
        }
      }
    };
    await Promise.all([
      addManagerId(),
      addReadingsCount(),
      addTotalLitresSold(),
      addTotalSalesAmount(),
      addStatus(),
      addEndedBy(),
      addNotes(),
      addEndNotes()
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all added columns
    await Promise.all([
      queryInterface.removeColumn("shifts", "manager_id"),
      queryInterface.removeColumn("shifts", "readings_count"),
      queryInterface.removeColumn("shifts", "total_litres_sold"),
      queryInterface.removeColumn("shifts", "total_sales_amount"),
      queryInterface.removeColumn("shifts", "status"),
      queryInterface.removeColumn("shifts", "ended_by"),
      queryInterface.removeColumn("shifts", "notes"),
      queryInterface.removeColumn("shifts", "end_notes")
    ]);
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_shifts_status";');
  }
};
